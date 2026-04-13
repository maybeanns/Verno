/**
 * Structured logging utility for the Verno extension.
 * - Writes to a named VSCode OutputChannel (visible via "Verno: Show Verno Output")
 * - Suppresses DEBUG in production builds; shows INFO+ always
 * - Prefixes every line with ISO timestamp and level
 * - `error()` appends the full stack trace when available
 */

import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private minLevel: LogLevel;

    /**
     * @param channelName  Name shown in the Output dropdown (e.g. "Verno")
     * @param minLevel     Minimum log level to emit. Defaults to INFO in production, DEBUG in development.
     */
    constructor(channelName: string = 'Verno', minLevel?: LogLevel) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);

        // Detect dev mode: set minLevel to DEBUG when running from source, INFO for packaged
        if (!minLevel) {
            const isDev = process.env.VSCODE_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development';
            this.minLevel = isDev ? 'DEBUG' : 'INFO';
        } else {
            this.minLevel = minLevel;
        }
    }

    info(message: string): void {
        this.log(message, 'INFO');
    }

    warn(message: string): void {
        this.log(message, 'WARN');
    }

    error(message: string, error?: Error): void {
        this.log(message, 'ERROR');
        if (error?.stack) {
            this.outputChannel.appendLine(`    Stack: ${error.stack.split('\n').join('\n    ')}`);
        } else if (error?.message) {
            this.outputChannel.appendLine(`    Error: ${error.message}`);
        }
    }

    debug(message: string): void {
        this.log(message, 'DEBUG');
    }

    private log(message: string, level: LogLevel): void {
        if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[this.minLevel]) { return; }
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [${level.padEnd(5)}] ${message}`);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
