/**
 * Agent context builder
 */

import { IAgentContext } from '../../types';

export class ContextBuilder {
  private context: Partial<IAgentContext> = {};

  setWorkspaceRoot(root: string): this {
    this.context.workspaceRoot = root;
    return this;
  }

  setSelectedText(text: string): this {
    this.context.selectedText = text;
    return this;
  }

  setFilePath(filePath: string): this {
    this.context.filePath = filePath;
    return this;
  }

  setFileContent(content: string): this {
    this.context.fileContent = content;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.context.metadata = metadata;
    return this;
  }

  build(): IAgentContext {
    if (!this.context.workspaceRoot) {
      throw new Error('Workspace root is required');
    }

    return {
      workspaceRoot: this.context.workspaceRoot,
      selectedText: this.context.selectedText,
      filePath: this.context.filePath,
      fileContent: this.context.fileContent,
      metadata: this.context.metadata
    };
  }
}
