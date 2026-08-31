/**
 * SandboxValidator — command allowlist and path containment enforcer.
 *
 * Validates shell commands before they are executed by SandboxService or
 * ShellCommandTool. Blocks any command not on the explicit allowlist and
 * any path that attempts directory traversal outside the sandbox root.
 *
 * Security model:
 *   - Allowlist by command prefix (first token)
 *   - Block absolute paths in arguments that escape the sandbox root
 *   - Block path traversal (../) patterns anywhere in the command
 */

import * as path from 'path';

export class SandboxViolationError extends Error {
  constructor(
    public readonly command: string,
    public readonly reason: string,
  ) {
    super(`SandboxViolationError: Command blocked — ${reason}\nCommand: "${command}"`);
    this.name = 'SandboxViolationError';
  }
}

/** Permitted command prefixes (case-insensitive). */
const ALLOWED_COMMANDS = new Set([
  'npm', 'npx', 'node', 'tsc', 'eslint',
  'jest', 'mocha', 'vitest',
  'pytest', 'python', 'python3',
  'cargo', 'rustup',
  'go', 'gofmt',
  'gradle', 'mvn',
  'git',           // Allow git status/diff — NOT git push/pull (enforced below)
  'echo', 'cat', 'ls', 'dir', 'pwd',
  'tsc', 'prettier',
]);

/** Dangerous command substrings that are never permitted. */
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /rmdir\s+\/s/i,
  /del\s+\/f/i,
  /format\s+[a-zA-Z]:/i,
  /shutdown/i,
  /reboot/i,
  /curl\s+.*\|\s*(bash|sh|cmd|powershell)/i,
  /wget\s+.*\|\s*(bash|sh|cmd|powershell)/i,
  /\.\.[\\/]/,       // Path traversal
  /\$\(.*\)/,        // Command substitution in shell strings (bash)
  /`[^`]*`/,         // Backtick command substitution
];

/** Git subcommands that are NOT safe to run in sandbox. */
const BLOCKED_GIT_SUBCOMMANDS = new Set(['push', 'pull', 'clone', 'fetch', 'remote', 'submodule']);

export class SandboxValidator {
  /**
   * Validate a command string. Throws SandboxViolationError if:
   *   - The command prefix is not on the allowlist
   *   - A blocked pattern is detected
   *   - A path argument escapes the sandbox root
   *
   * @param command     Full shell command string to validate
   * @param sandboxRoot Absolute path of the sandbox directory
   */
  public static validate(command: string, sandboxRoot: string): void {
    const trimmed = command.trim();

    // 1. Check blocked patterns first
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new SandboxViolationError(trimmed, `Matched blocked pattern: ${pattern.source}`);
      }
    }

    // 2. Extract command prefix (handle paths like /usr/bin/npm → npm)
    const tokens = trimmed.split(/\s+/);
    const firstToken = path.basename(tokens[0]).toLowerCase().replace(/\.(exe|cmd|bat)$/i, '');

    if (!ALLOWED_COMMANDS.has(firstToken)) {
      throw new SandboxViolationError(trimmed, `Command '${firstToken}' is not on the sandbox allowlist`);
    }

    // 3. Additional git subcommand check
    if (firstToken === 'git' && tokens.length > 1) {
      const subCommand = tokens[1].toLowerCase();
      if (BLOCKED_GIT_SUBCOMMANDS.has(subCommand)) {
        throw new SandboxViolationError(trimmed, `git '${subCommand}' is not allowed in sandbox`);
      }
    }

    // 4. Path containment: ensure any absolute path arguments are inside the sandbox
    const resolvedSandbox = path.resolve(sandboxRoot);
    for (const token of tokens.slice(1)) {
      if (path.isAbsolute(token)) {
        const resolved = path.resolve(token);
        if (!resolved.startsWith(resolvedSandbox)) {
          throw new SandboxViolationError(
            trimmed,
            `Absolute path argument '${token}' is outside the sandbox root '${resolvedSandbox}'`,
          );
        }
      }
    }
  }

  /** Returns true if the command would pass validation (non-throwing form). */
  public static isAllowed(command: string, sandboxRoot: string): boolean {
    try {
      SandboxValidator.validate(command, sandboxRoot);
      return true;
    } catch {
      return false;
    }
  }

  /** List all allowed command prefixes for display in settings/UI. */
  public static getAllowedCommands(): string[] {
    return Array.from(ALLOWED_COMMANDS).sort();
  }
}
