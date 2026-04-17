/**
 * SecretScannerService — Phase 10 (SDLC Phase 8)
 *
 * Scans workspace files for credential leaks using the SECRET_PATTERNS library.
 * Also manages injection and removal of the git pre-commit hook.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SECRET_PATTERNS, SCAN_EXCLUSIONS, SCAN_EXTENSIONS, SecretPattern } from './templates/secret-patterns';
import { Logger } from '../../utils/logger';

export interface SecretFinding {
    file: string;           // relative path from workspace root
    line: number;           // 1-indexed line number
    column: number;         // 1-indexed column
    patternId: string;
    patternName: string;
    severity: 'critical' | 'high' | 'medium';
    snippet: string;        // redacted: first 20 chars of match
    falsePositiveHint?: string;
}

export interface ScanResult {
    scannedFiles: number;
    findings: SecretFinding[];
    durationMs: number;
}

export class SecretScannerService {
    constructor(
        private readonly workspaceRoot: string,
        private readonly logger: Logger
    ) {}

    /**
     * Scans all eligible files in the workspace for secret patterns.
     */
    async scan(): Promise<ScanResult> {
        const start = Date.now();
        const files = this.collectFiles(this.workspaceRoot);
        const findings: SecretFinding[] = [];

        for (const filePath of files) {
            const fileFindings = this.scanFile(filePath);
            findings.push(...fileFindings);
        }

        const result: ScanResult = {
            scannedFiles: files.length,
            findings,
            durationMs: Date.now() - start,
        };

        this.logger.info(
            `[SecretScanner] Scanned ${files.length} files — ${findings.length} finding(s) in ${result.durationMs}ms`
        );
        return result;
    }

    /**
     * Scans a specific list of files (e.g., git staged files).
     */
    scanFiles(filePaths: string[]): SecretFinding[] {
        return filePaths.flatMap(f => this.scanFile(f));
    }

    /**
     * Installs the pre-commit hook into .git/hooks/pre-commit.
     * Returns true on success, false if .git directory not found.
     */
    installPreCommitHook(): boolean {
        const gitHooksDir = path.join(this.workspaceRoot, '.git', 'hooks');
        if (!fs.existsSync(gitHooksDir)) {
            this.logger.warn('[SecretScanner] .git/hooks not found — not a git repository');
            return false;
        }

        const hookPath = path.join(gitHooksDir, 'pre-commit');

        // If a hook already exists and is not ours, back it up
        if (fs.existsSync(hookPath)) {
            const existing = fs.readFileSync(hookPath, 'utf-8');
            if (!existing.includes('VERNO_SECRET_SCANNER')) {
                const backupPath = hookPath + '.pre-verno';
                fs.copyFileSync(hookPath, backupPath);
                this.logger.info(`[SecretScanner] Existing hook backed up to ${backupPath}`);
            }
        }

        const hookScript = this.buildHookScript();
        fs.writeFileSync(hookPath, hookScript, { encoding: 'utf-8', mode: 0o755 });
        this.logger.info(`[SecretScanner] Pre-commit hook installed at ${hookPath}`);
        return true;
    }

    /**
     * Removes the Verno-managed pre-commit hook.
     * Restores backup if one exists.
     */
    uninstallPreCommitHook(): boolean {
        const hookPath = path.join(this.workspaceRoot, '.git', 'hooks', 'pre-commit');
        const backupPath = hookPath + '.pre-verno';

        if (!fs.existsSync(hookPath)) {
            return false;
        }

        const content = fs.readFileSync(hookPath, 'utf-8');
        if (!content.includes('VERNO_SECRET_SCANNER')) {
            this.logger.warn('[SecretScanner] Hook not managed by Verno — not removing');
            return false;
        }

        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, hookPath);
            fs.unlinkSync(backupPath);
            this.logger.info('[SecretScanner] Restored pre-existing hook from backup');
        } else {
            fs.unlinkSync(hookPath);
        }
        return true;
    }

    /**
     * Returns true if the Verno-managed hook is currently installed.
     */
    isHookInstalled(): boolean {
        const hookPath = path.join(this.workspaceRoot, '.git', 'hooks', 'pre-commit');
        if (!fs.existsSync(hookPath)) { return false; }
        return fs.readFileSync(hookPath, 'utf-8').includes('VERNO_SECRET_SCANNER');
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private collectFiles(dir: string, collected: string[] = []): string[] {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return collected;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.workspaceRoot, fullPath);

            if (this.isExcluded(entry.name, relativePath)) { continue; }

            if (entry.isDirectory()) {
                this.collectFiles(fullPath, collected);
            } else if (entry.isFile() && this.shouldScan(entry.name)) {
                collected.push(fullPath);
            }
        }
        return collected;
    }

    private isExcluded(name: string, relativePath: string): boolean {
        return SCAN_EXCLUSIONS.some(excl => {
            if (excl.startsWith('*')) {
                return name.endsWith(excl.slice(1));
            }
            return name === excl || relativePath.startsWith(excl);
        });
    }

    private shouldScan(filename: string): boolean {
        const ext = path.extname(filename).toLowerCase();
        const base = path.basename(filename);
        return SCAN_EXTENSIONS.includes(ext) || SCAN_EXTENSIONS.includes(base);
    }

    private scanFile(filePath: string): SecretFinding[] {
        let content: string;
        try {
            content = fs.readFileSync(filePath, 'utf-8');
        } catch {
            return [];
        }

        const lines = content.split('\n');
        const findings: SecretFinding[] = [];
        const relativePath = path.relative(this.workspaceRoot, filePath);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (const pattern of SECRET_PATTERNS) {
                const match = pattern.pattern.exec(line);
                if (match) {
                    findings.push({
                        file: relativePath,
                        line: lineIndex + 1,
                        column: match.index + 1,
                        patternId: pattern.id,
                        patternName: pattern.name,
                        severity: pattern.severity,
                        snippet: match[0].substring(0, 6) + '***' + match[0].slice(-3),
                        falsePositiveHint: pattern.falsePositiveHint,
                    });
                }
            }
        }

        return findings;
    }

    private buildHookScript(): string {
        // VERNO_SECRET_SCANNER marker is used to identify this hook
        return `#!/usr/bin/env node
// VERNO_SECRET_SCANNER v1.0 — auto-generated by Verno (Phase 10)
// Remove with: verno.uninstallSecretScanner command in VS Code

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get list of staged files
let stagedFiles = [];
try {
  const output = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf-8' });
  stagedFiles = output.trim().split('\\n').filter(Boolean);
} catch (e) {
  process.exit(0); // If git fails, don't block the commit
}

const SCAN_EXTENSIONS = [
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.cs', '.php',
  '.env', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.sh', '.tf', '.tfvars',
];

const PATTERNS = [
  { id: 'AWS_ACCESS_KEY', name: 'AWS Access Key ID', pattern: /AKIA[0-9A-Z]{16}/ },
  { id: 'GCP_API_KEY', name: 'Google Cloud API Key', pattern: /AIza[0-9A-Za-z\\-_]{35}/ },
  { id: 'GITHUB_TOKEN', name: 'GitHub Token', pattern: /gh[pos]_[a-zA-Z0-9]{36}/ },
  { id: 'GITHUB_PAT', name: 'GitHub Fine-Grained PAT', pattern: /github_pat_[a-zA-Z0-9_]{82}/ },
  { id: 'STRIPE_LIVE', name: 'Stripe Live Key', pattern: /sk_live_[a-zA-Z0-9]{24,}/ },
  { id: 'PRIVATE_KEY', name: 'Private Key (PEM)', pattern: /-----BEGIN (RSA|EC|OPENSSH|) ?PRIVATE KEY-----/ },
  { id: 'DB_CONN', name: 'Database Connection String', pattern: /(?:postgres|mysql|mongodb|redis):\\/\\/[^:@\\s]+:[^@\\s]{3,}@/i },
  { id: 'PASSWORD', name: 'Hardcoded Password', pattern: /(?:password|passwd|pwd)\\s*[=:]\\s*["'][^"'\\s]{4,}["']/i },
  { id: 'API_KEY', name: 'Generic API Key', pattern: /api[_\\-]?key\\s*[=:]\\s*["'][a-zA-Z0-9\\-_]{16,}["']/i },
];

const findings = [];

for (const file of stagedFiles) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  if (!SCAN_EXTENSIONS.includes(ext) && !SCAN_EXTENSIONS.includes(base)) { continue; }
  if (!fs.existsSync(file)) { continue; }

  let content;
  try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

  const lines = content.split('\\n');
  for (let i = 0; i < lines.length; i++) {
    for (const p of PATTERNS) {
      if (p.pattern.test(lines[i])) {
        findings.push({ file, line: i + 1, patternName: p.name });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('\\n╔══════════════════════════════════════════════════════╗');
  console.error('║  VERNO SECRET SCANNER — COMMIT BLOCKED               ║');
  console.error('╚══════════════════════════════════════════════════════╝');
  console.error('\\nPotential secrets detected in staged files:\\n');
  findings.forEach(f => {
    console.error(\`  ✗ \${f.file}:\${f.line} — \${f.patternName}\`);
  });
  console.error('\\nFix: Remove secrets, use environment variables or VSCode SecretStorage.');
  console.error('Override (not recommended): git commit --no-verify\\n');
  process.exit(1);
}

process.exit(0);
`;
    }
}
