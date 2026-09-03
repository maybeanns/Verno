/**
 * SandboxService — hardened workspace shadow-copy execution environment.
 *
 * Security improvements over the naive exec-based approach:
 *   1. All commands are validated through SandboxValidator before execution
 *   2. Uses child_process.spawn (not exec) for process isolation
 *   3. stdout/stderr are capped to prevent memory pressure
 *   4. SIGKILL enforced on timeout — not just SIGTERM (Windows: taskkill /F)
 *   5. No shell expansion (shell: false) to prevent injection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { SandboxValidator, SandboxViolationError } from './SandboxValidator';

export { SandboxViolationError } from './SandboxValidator';

export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  blocked?: boolean;
}

const MAX_OUTPUT_BYTES = 200_000; // 200 KB per stream

export class SandboxService {
  private sandboxPath: string | null = null;

  constructor() {}

  /**
   * Create temporary shadow directory and copy workspace files (skipping build/node modules).
   */
  public async createSandbox(workspaceRoot: string): Promise<string> {
    this.sandboxPath = fs.mkdtempSync(path.join(os.tmpdir(), 'verno-sandbox-'));
    await this.copyRecursive(workspaceRoot, this.sandboxPath);
    return this.sandboxPath;
  }

  /**
   * Execute a validated command inside the sandboxed shadow directory.
   * Returns a result with blocked=true if the command was rejected by SandboxValidator.
   */
  public async executeCommand(cmd: string, timeoutMs = 60_000): Promise<SandboxCommandResult> {
    if (!this.sandboxPath) {
      throw new Error('Sandbox has not been initialized. Call createSandbox() first.');
    }

    // Validate before execution
    try {
      SandboxValidator.validate(cmd, this.sandboxPath);
    } catch (err) {
      if (err instanceof SandboxViolationError) {
        return { stdout: '', stderr: err.message, exitCode: 126, durationMs: 0, blocked: true };
      }
      throw err;
    }

    const start = Date.now();

    return new Promise((resolve) => {
      const [bin, ...args] = cmd.trim().split(/\s+/);

      const proc = childProcess.spawn(bin, args, {
        cwd: this.sandboxPath!,
        timeout: timeoutMs,
        stdio: 'pipe',
        detached: false,
        shell: false, // Critical: no shell expansion
        env: { ...process.env, CI: 'true', NPM_CONFIG_YES: 'true' },
      });

      let stdoutBuf = '';
      let stderrBuf = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        if (Buffer.byteLength(stdoutBuf) < MAX_OUTPUT_BYTES) {
          stdoutBuf += chunk.toString();
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        if (Buffer.byteLength(stderrBuf) < MAX_OUTPUT_BYTES) {
          stderrBuf += chunk.toString();
        }
      });

      proc.on('close', (code) => {
        resolve({
          stdout: stdoutBuf,
          stderr: stderrBuf,
          exitCode: code ?? 1,
          durationMs: Date.now() - start,
        });
      });

      proc.on('error', (err) => {
        resolve({
          stdout: '',
          stderr: `Process error: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - start,
        });
      });

      // Hard kill on timeout
      setTimeout(() => {
        if (!proc.killed) {
          try {
            if (process.platform === 'win32') {
              childProcess.spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
            } else {
              proc.kill('SIGKILL');
            }
          } catch { /* already exited */ }
        }
      }, timeoutMs + 1000);
    });
  }

  /**
   * Copy verified files back to the original workspace.
   */
  public async syncBack(workspaceRoot: string, filePaths: string[]): Promise<void> {
    if (!this.sandboxPath) {
      throw new Error('Sandbox has not been initialized');
    }

    for (const file of filePaths) {
      const src = path.join(this.sandboxPath, file);
      const dest = path.join(workspaceRoot, file);

      if (fs.existsSync(src)) {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
      }
    }
  }

  /**
   * Clean up the temporary sandbox directory.
   */
  public clean(): void {
    if (this.sandboxPath && fs.existsSync(this.sandboxPath)) {
      try {
        fs.rmSync(this.sandboxPath, { recursive: true, force: true });
      } catch { /* Suppress deletion error */ }
      this.sandboxPath = null;
    }
  }

  public getPath(): string | null {
    return this.sandboxPath;
  }

  private async copyRecursive(src: string, dest: string): Promise<void> {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = stats && stats.isDirectory();

    const IGNORE = new Set([
      'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
      '.venv', 'venv', 'target', '.verno', 'coverage', '.turbo', 'out',
    ]);

    if (isDirectory) {
      if (IGNORE.has(path.basename(src))) return;
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const files = fs.readdirSync(src);
      for (const file of files) {
        await this.copyRecursive(path.join(src, file), path.join(dest, file));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}
