/**
 * ShellCommandTool — executes a sandboxed shell command.
 * Tool name: "shell-command"
 *
 * Routes through SandboxValidator before execution. Blocked commands
 * throw a SandboxViolationError rather than running on the host OS.
 */

import * as childProcess from 'child_process';
import { VernoTool } from '../ToolRegistry';
import { SandboxValidator } from '../../sandbox/SandboxValidator';

export interface ShellCommandInput {
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface ShellCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export const ShellCommandTool: VernoTool<ShellCommandInput, ShellCommandOutput> = {
  name: 'shell-command',
  description: 'Execute an allowlisted shell command in the specified working directory.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute (must be on the allowlist)' },
      cwd: { type: 'string', description: 'Absolute working directory for the command' },
      timeoutMs: { type: 'number', description: 'Execution timeout in milliseconds (default 60000)' },
    },
    required: ['command', 'cwd'],
  },

  async execute(input: ShellCommandInput): Promise<ShellCommandOutput> {
    // Validate before execution — throws SandboxViolationError for blocked commands
    SandboxValidator.validate(input.command, input.cwd);

    const timeout = input.timeoutMs ?? 60_000;
    const start = Date.now();

    return new Promise((resolve) => {
      const proc = childProcess.spawn('cmd', ['/c', input.command], {
        cwd: input.cwd,
        timeout,
        stdio: 'pipe',
        detached: false,
        env: { ...process.env, CI: 'true' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        resolve({
          stdout: stdout.slice(0, 200_000), // cap at 200KB to prevent memory pressure
          stderr: stderr.slice(0, 50_000),
          exitCode: code ?? 1,
          durationMs: Date.now() - start,
        });
      });

      proc.on('error', (err) => {
        resolve({ stdout: '', stderr: err.message, exitCode: 1, durationMs: Date.now() - start });
      });
    });
  },
};
