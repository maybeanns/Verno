/**
 * secret-patterns.ts — Regex patterns for credential/secret detection.
 * Phase 10: Pre-Commit Secret Scanner
 *
 * Each pattern includes an id, human-readable name, regex, and severity.
 * Patterns are ordered by severity (critical first).
 */

export type SecretSeverity = 'critical' | 'high' | 'medium';

export interface SecretPattern {
    id: string;
    name: string;
    pattern: RegExp;
    severity: SecretSeverity;
    falsePositiveHint?: string;  // Common false positive this pattern may trigger
}

export const SECRET_PATTERNS: SecretPattern[] = [
    // ── Critical: Cloud provider credentials ──────────────────────────────
    {
        id: 'AWS_ACCESS_KEY',
        name: 'AWS Access Key ID',
        pattern: /AKIA[0-9A-Z]{16}/,
        severity: 'critical',
    },
    {
        id: 'AWS_SECRET_KEY',
        name: 'AWS Secret Access Key',
        pattern: /(?:aws[_\-\s]?secret|secret[_\-\s]?access[_\-\s]?key)\s*[=:]\s*["']?[0-9a-zA-Z/+]{40}["']?/i,
        severity: 'critical',
    },
    {
        id: 'GCP_API_KEY',
        name: 'Google Cloud API Key',
        pattern: /AIza[0-9A-Za-z\-_]{35}/,
        severity: 'critical',
    },

    // ── Critical: GitHub credentials ─────────────────────────────────────
    {
        id: 'GITHUB_TOKEN_CLASSIC',
        name: 'GitHub Personal Access Token (classic)',
        pattern: /ghp_[a-zA-Z0-9]{36}/,
        severity: 'critical',
    },
    {
        id: 'GITHUB_TOKEN_FINE_GRAINED',
        name: 'GitHub Fine-Grained PAT',
        pattern: /github_pat_[a-zA-Z0-9_]{82}/,
        severity: 'critical',
    },
    {
        id: 'GITHUB_OAUTH_TOKEN',
        name: 'GitHub OAuth Token',
        pattern: /gho_[a-zA-Z0-9]{36}/,
        severity: 'critical',
    },

    // ── Critical: Payment processor keys ─────────────────────────────────
    {
        id: 'STRIPE_SECRET_KEY',
        name: 'Stripe Secret Key (Live)',
        pattern: /sk_live_[a-zA-Z0-9]{24,}/,
        severity: 'critical',
    },
    {
        id: 'STRIPE_SECRET_KEY_TEST',
        name: 'Stripe Secret Key (Test)',
        pattern: /sk_test_[a-zA-Z0-9]{24,}/,
        severity: 'high',
        falsePositiveHint: 'Test keys are lower risk but still should not be committed',
    },

    // ── Critical: Private keys ────────────────────────────────────────────
    {
        id: 'PRIVATE_KEY_RSA',
        name: 'RSA Private Key (PEM)',
        pattern: /-----BEGIN RSA PRIVATE KEY-----/,
        severity: 'critical',
    },
    {
        id: 'PRIVATE_KEY_EC',
        name: 'EC Private Key (PEM)',
        pattern: /-----BEGIN EC PRIVATE KEY-----/,
        severity: 'critical',
    },
    {
        id: 'PRIVATE_KEY_OPENSSH',
        name: 'OpenSSH Private Key',
        pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
        severity: 'critical',
    },
    {
        id: 'PRIVATE_KEY_GENERIC',
        name: 'Generic Private Key (PEM)',
        pattern: /-----BEGIN PRIVATE KEY-----/,
        severity: 'critical',
    },

    // ── High: JWT tokens ──────────────────────────────────────────────────
    {
        id: 'JWT_TOKEN',
        name: 'JSON Web Token',
        pattern: /eyJ[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_.+/=]{10,}/,
        severity: 'high',
        falsePositiveHint: 'Some JWTs are public (e.g., in test fixtures) — review context',
    },

    // ── High: Database connection strings with embedded passwords ─────────
    {
        id: 'DB_CONNECTION_STRING',
        name: 'Database Connection String with Password',
        pattern: /(?:postgres|mysql|mongodb|mssql|redis):\/\/[^:@\s]+:[^@\s]{3,}@/i,
        severity: 'high',
    },

    // ── High: Common hardcoded password patterns ──────────────────────────
    {
        id: 'HARDCODED_PASSWORD',
        name: 'Hardcoded Password Assignment',
        pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{4,}["']/i,
        severity: 'high',
        falsePositiveHint: 'May trigger on placeholder strings like "password=changeme" in docs',
    },

    // ── Medium: Generic API key assignments ───────────────────────────────
    {
        id: 'GENERIC_API_KEY',
        name: 'Generic API Key Assignment',
        pattern: /api[_\-]?key\s*[=:]\s*["'][a-zA-Z0-9\-_]{16,}["']/i,
        severity: 'medium',
        falsePositiveHint: 'May trigger on example/placeholder values — review manually',
    },
    {
        id: 'GENERIC_SECRET_KEY',
        name: 'Generic Secret Key Assignment',
        pattern: /(?:secret[_\-]?key|api[_\-]?secret)\s*[=:]\s*["'][a-zA-Z0-9\-_]{16,}["']/i,
        severity: 'medium',
    },
    {
        id: 'BEARER_TOKEN',
        name: 'Bearer Token in Source',
        pattern: /Bearer\s+[a-zA-Z0-9\-_]{20,}/,
        severity: 'medium',
        falsePositiveHint: 'May appear in test fixtures or documentation — review context',
    },
];

// Files/directories to always skip during scanning
export const SCAN_EXCLUSIONS: string[] = [
    'node_modules',
    '.git',
    'dist',
    'out',
    '.vscode',
    '.verno',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '*.min.js',
    '*.map',
];

// File extensions to scan (source + config files only)
export const SCAN_EXTENSIONS: string[] = [
    '.ts', '.js', '.tsx', '.jsx',
    '.py', '.rb', '.go', '.java', '.cs', '.php',
    '.env', '.env.local', '.env.development', '.env.production',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.sh', '.bash', '.zsh', '.ps1',
    '.dockerfile', 'Dockerfile',
    '.tf', '.tfvars',
    '.xml', '.properties',
];
