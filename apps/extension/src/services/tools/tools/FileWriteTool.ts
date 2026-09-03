/**
 * FileWriteTool — writes or appends content to a file in the workspace.
 * Tool name: "file-write"
 */

import * as fs from 'fs';
import * as path from 'path';
import { VernoTool } from '../ToolRegistry';

export interface FileWriteInput {
  filePath: string;
  content: string;
  mode?: 'overwrite' | 'append' | 'create-only';
}

export interface FileWriteOutput {
  filePath: string;
  bytesWritten: number;
  created: boolean;
}

export const FileWriteTool: VernoTool<FileWriteInput, FileWriteOutput> = {
  name: 'file-write',
  description: 'Write or append content to a file. Supports overwrite, append, and create-only modes.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Absolute or workspace-relative path to write to' },
      content: { type: 'string', description: 'Content to write into the file' },
      mode: {
        type: 'string',
        description: 'Write mode: overwrite (default), append, or create-only (fails if file exists)',
        enum: ['overwrite', 'append', 'create-only'],
      },
    },
    required: ['filePath', 'content'],
  },

  async execute(input: FileWriteInput): Promise<FileWriteOutput> {
    const resolved = path.isAbsolute(input.filePath) ? input.filePath : path.resolve(input.filePath);
    const mode = input.mode ?? 'overwrite';
    const existed = fs.existsSync(resolved);

    if (mode === 'create-only' && existed) {
      throw new Error(`File already exists and mode is 'create-only': ${resolved}`);
    }

    // Ensure parent directories exist
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const flag = mode === 'append' ? 'a' : 'w';
    fs.writeFileSync(resolved, input.content, { encoding: 'utf-8', flag });

    return {
      filePath: resolved,
      bytesWritten: Buffer.byteLength(input.content, 'utf-8'),
      created: !existed,
    };
  },
};
