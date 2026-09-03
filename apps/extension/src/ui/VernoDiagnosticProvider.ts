/**
 * VernoDiagnosticProvider — emits VS Code diagnostic squiggles from agent analysis.
 *
 * When the ConversationalAgent detects issues (security vulnerabilities, architectural
 * drift, documentation gaps) in open files, it calls addDiagnostic() to surface them
 * as standard VS Code Diagnostics — the same wavy underlines produced by TypeScript or
 * ESLint. Users can hover to see the issue and trigger quick-fix code actions.
 *
 * This replaces inline chat-panel warnings and makes issues visible in the Problems panel.
 */

import * as vscode from 'vscode';

export type VernoDiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';
export type VernoDiagnosticCategory = 'security' | 'architecture' | 'documentation' | 'performance' | 'general';

export interface VernoDiagnosticEntry {
  uri: vscode.Uri;
  /** 0-indexed line number */
  line: number;
  /** 0-indexed start character (default 0) */
  startChar?: number;
  /** 0-indexed end character (default end of line) */
  endChar?: number;
  message: string;
  severity: VernoDiagnosticSeverity;
  category: VernoDiagnosticCategory;
  code?: string;
  /** Optional quick-fix hint surfaced as a code action label */
  fixHint?: string;
}

const CATEGORY_CODES: Record<VernoDiagnosticCategory, string> = {
  security: 'VERNO-SEC',
  architecture: 'VERNO-ARC',
  documentation: 'VERNO-DOC',
  performance: 'VERNO-PERF',
  general: 'VERNO',
};

export class VernoDiagnosticProvider {
  private readonly collection: vscode.DiagnosticCollection;

  /** Map from uri.toString() → pending entries for batch flush */
  private readonly pending = new Map<string, vscode.Diagnostic[]>();

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('verno');
  }

  /**
   * Add a diagnostic for a specific location in a file.
   * Diagnostics are batched and flushed with flushDiagnostics().
   */
  public addDiagnostic(entry: VernoDiagnosticEntry): void {
    const severity = this.mapSeverity(entry.severity);

    // Get line length to set a sensible range
    const lineText = this.getLineText(entry.uri, entry.line);
    const endChar = entry.endChar ?? (lineText?.length ?? 120);

    const range = new vscode.Range(
      new vscode.Position(entry.line, entry.startChar ?? 0),
      new vscode.Position(entry.line, endChar),
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      entry.message,
      severity,
    );

    diagnostic.source = 'Verno';
    diagnostic.code = entry.code ?? CATEGORY_CODES[entry.category];

    const key = entry.uri.toString();
    if (!this.pending.has(key)) {
      this.pending.set(key, []);
    }
    this.pending.get(key)!.push(diagnostic);
  }

  /**
   * Flush all pending diagnostics to the VS Code Problems panel.
   * Call after a batch of addDiagnostic() calls.
   */
  public flushDiagnostics(): void {
    for (const [uriStr, diagnostics] of this.pending) {
      const uri = vscode.Uri.parse(uriStr);
      // Merge with any existing diagnostics for this file
      const existing = this.collection.get(uri) ?? [];
      this.collection.set(uri, [...existing, ...diagnostics]);
    }
    this.pending.clear();
  }

  /**
   * Clear all Verno diagnostics for a specific file.
   * Useful when a file is saved and re-analyzed.
   */
  public clearFile(uri: vscode.Uri): void {
    this.collection.delete(uri);
    this.pending.delete(uri.toString());
  }

  /** Clear all Verno diagnostics across all files. */
  public clearAll(): void {
    this.collection.clear();
    this.pending.clear();
  }

  /** Report a security finding quickly (convenience wrapper). */
  public reportSecurityIssue(
    uri: vscode.Uri,
    line: number,
    message: string,
    code?: string,
  ): void {
    this.addDiagnostic({ uri, line, message, severity: 'warning', category: 'security', code });
    this.flushDiagnostics();
  }

  /** Report an architecture drift finding (convenience wrapper). */
  public reportArchitectureDrift(uri: vscode.Uri, line: number, message: string): void {
    this.addDiagnostic({ uri, line, message, severity: 'info', category: 'architecture' });
    this.flushDiagnostics();
  }

  /** Dispose the underlying DiagnosticCollection. Call in extension.deactivate(). */
  public dispose(): void {
    this.collection.dispose();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private mapSeverity(severity: VernoDiagnosticSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error':   return vscode.DiagnosticSeverity.Error;
      case 'warning': return vscode.DiagnosticSeverity.Warning;
      case 'info':    return vscode.DiagnosticSeverity.Information;
      case 'hint':    return vscode.DiagnosticSeverity.Hint;
    }
  }

  private getLineText(uri: vscode.Uri, line: number): string | undefined {
    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
    if (!doc || line >= doc.lineCount) return undefined;
    return doc.lineAt(line).text;
  }
}
