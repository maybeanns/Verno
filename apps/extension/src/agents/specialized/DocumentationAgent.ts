/**
 * Documentation agent for generating API and code documentation
 */

import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { ISpecializedAgent } from '../../types/agents';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import * as path from 'path';

export class DocumentationAgent extends BaseAgent implements ISpecializedAgent {
  name = 'DocumentationAgent';
  description = 'Generates comprehensive documentation for code and APIs';

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService
  ) {
    super(logger);
  }

  validateInput(context: IAgentContext): boolean {
    return this.validateContext(context) && (!!context.fileContent || !!context.metadata?.codeAnalysis);
  }

  async preProcess(context: IAgentContext): Promise<IAgentContext> {
    this.log('Pre-processing documentation request');
    return context;
  }

  async execute(context: IAgentContext): Promise<string> {
    if (!this.validateInput(context)) {
      throw new Error('Invalid input for documentation generation');
    }

    this.log('Generating documentation');
    
    try {
      const codeAnalysis = context.metadata?.codeAnalysis as string;
      const workspaceRoot = context.workspaceRoot;

      // Generate README
      const readmePrompt = `Generate a comprehensive README.md for this project specification: ${codeAnalysis}. Include installation, usage, and API documentation.`;
      const readmeContent = await this.llmService.generateText(readmePrompt);
      
      const readmePath = path.join(workspaceRoot, 'generated', 'README.md');
      await this.fileService.createFile(readmePath, readmeContent);
      this.log(`README created: ${readmePath}`);

      // Generate API documentation
      const apiDocPrompt = `Generate detailed API documentation for this specification: ${codeAnalysis}. Include all endpoints, parameters, and examples.`;
      const apiDocContent = await this.llmService.generateText(apiDocPrompt);
      
      const apiDocPath = path.join(workspaceRoot, 'generated', 'API.md');
      await this.fileService.createFile(apiDocPath, apiDocContent);
      this.log(`API documentation created: ${apiDocPath}`);

      return await this.postProcess('Documentation generation complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Documentation generation error: ${errorMsg}`, 'error');
      throw error;
    }
  }

  async postProcess(output: string): Promise<string> {
    this.log('Post-processing documentation');
    return output;
  }
}
