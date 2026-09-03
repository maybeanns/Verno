import * as fs from 'fs';
import * as path from 'path';

export interface FileChange {
  filePath: string;
  operation: 'create' | 'update' | 'delete';
  oldContent?: string;
  newContent?: string;
  timestamp: number;
}

/**
 * Tracks file changes made by agents for diff viewing
 */
export class FileChangeTracker {
  private changes: FileChange[] = [];

  recordChange(filePath: string, newContent: string, oldContent?: string): void {
    const operation = oldContent ? 'update' : 'create';
    this.changes.push({
      filePath,
      operation,
      oldContent,
      newContent,
      timestamp: Date.now()
    });
  }

  recordDelete(filePath: string, oldContent: string): void {
    this.changes.push({
      filePath,
      operation: 'delete',
      oldContent,
      timestamp: Date.now()
    });
  }

  getChanges(): FileChange[] {
    return [...this.changes];
  }

  getDiffSummary(): string {
    let summary = '';
    for (const change of this.changes) {
      summary += `${change.operation.toUpperCase()}: ${change.filePath}\n`;
      if (change.operation === 'create' || change.operation === 'update') {
        const lines = change.newContent?.split('\n').length || 0;
        summary += `  Lines: ${lines}\n`;
      }
    }
    return summary;
  }

  getDiffForFile(filePath: string): { before: string; after: string } | null {
    const change = this.changes.find(c => c.filePath === filePath);
    if (!change) return null;
    return {
      before: change.oldContent || '',
      after: change.newContent || ''
    };
  }

  clear(): void {
    this.changes = [];
  }
}
