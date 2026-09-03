/**
 * File operations service
 */

import { IFileService } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

export class FileService implements IFileService {
  private fileTimestamps = new Map<string, number>();
  private writeQueue = new Map<string, Promise<void>>();

  async createFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return this.queueWrite(filePath, async () => {
      fs.writeFileSync(filePath, content, 'utf-8');
      if (fs.existsSync(filePath)) {
        this.fileTimestamps.set(filePath, fs.statSync(filePath).mtimeMs);
      }
    });
  }

  async readFile(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    this.fileTimestamps.set(filePath, fs.statSync(filePath).mtimeMs);
    return content;
  }

  async updateFile(filePath: string, content: string, allowOverwrite = false): Promise<void> {
    return this.queueWrite(filePath, async () => {
      // Conflict detection
      if (!allowOverwrite && fs.existsSync(filePath)) {
        const currentMtime = fs.statSync(filePath).mtimeMs;
        const lastReadTime = this.fileTimestamps.get(filePath);
        if (lastReadTime && currentMtime > lastReadTime) {
          throw new Error(`FILE_CONFLICT: ${filePath} was modified by another process. Please re-read and merge.`);
        }
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      this.fileTimestamps.set(filePath, fs.statSync(filePath).mtimeMs);
    });
  }

  private queueWrite(filePath: string, operation: () => Promise<void>): Promise<void> {
    const currentPromise = this.writeQueue.get(filePath) || Promise.resolve();
    const nextPromise = currentPromise.then(() => operation());
    this.writeQueue.set(filePath, nextPromise.catch(() => {})); // ensure chain doesn't break
    return nextPromise;
  }

  /**
   * Applies an incremental diff patch using <<<< ==== >>>> blocks.
   * Format:
   * <<<<
   * old string exact
   * ====
   * new string
   * >>>>
   */
  async applyPatch(filePath: string, patchContent: string): Promise<void> {
    return this.queueWrite(filePath, async () => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist to be patched.`);
      }

      let content = fs.readFileSync(filePath, 'utf-8');
      
      const blockRegex = /<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g;
      let match;
      let blocksProcessed = 0;

      while ((match = blockRegex.exec(patchContent)) !== null) {
        const oldCode = match[1];
        const newCode = match[2];
        
        if (content.includes(oldCode)) {
          content = content.replace(oldCode, newCode);
          blocksProcessed++;
        } else {
          // If strict match fails, try trimming leading/trailing whitespace
          const oldTrimmed = oldCode.trim();
          if (content.includes(oldTrimmed)) {
              content = content.replace(oldTrimmed, newCode.trim());
              blocksProcessed++;
          } else {
              throw new Error(`Could not find old code snippet to replace in ${filePath}:\n${oldCode}`);
          }
        }
      }

      if (blocksProcessed === 0) {
        throw new Error('No valid <<<< ==== >>>> patch blocks found in the diff output.');
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      this.fileTimestamps.set(filePath, fs.statSync(filePath).mtimeMs);
    });
  }
}
