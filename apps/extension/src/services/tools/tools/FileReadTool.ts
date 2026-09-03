/**
 * FileReadTool — reads a file from the workspace.
 * Tool name: "file-read"
 */

import * as fs from 'fs';
import * as path from 'path';
import { VernoTool } from '../ToolRegistry';

export interface FileReadInput {
  filePath: string;
  /** Optional: read only lines [startLine, endLine] (1-indexed, inclusive) */
  startLine?: number;
  endLine?: number;
}

export interface FileReadOutput {
  content: string;
  totalLines: number;
  filePath: string;
}

export const FileReadTool: VernoTool<FileReadInput, FileReadOutput> = {
  name: 'file-read',
  description: 'Read the content of a file at the given workspace-relative or absolute path.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Absolute or workspace-relative file path to read' },
      startLine: { type: 'number', description: 'Optional start line (1-indexed)' },
      endLine: { type: 'number', description: 'Optional end line (1-indexed, inclusive)' },
    },
    required: ['filePath'],
  },

  async execute(input: FileReadInput): Promise<FileReadOutput> {
    const resolved = path.isAbsolute(input.filePath) ? input.filePath : path.resolve(input.filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }

    const raw = fs.readFileSync(resolved, 'utf-8');
    const allLines = raw.split('\n');
    const totalLines = allLines.length;

    let content = raw;
    if (input.startLine !== undefined || input.endLine !== undefined) {
      const start = Math.max(0, (input.startLine ?? 1) - 1);
      const end = Math.min(totalLines, (input.endLine ?? totalLines));
      content = allLines.slice(start, end).join('\n');
    }

    return { content, totalLines, filePath: resolved };
  },
};
