/**
 * Code generator agent for generating code from specifications
 */

import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { ISpecializedAgent } from '../../types/agents';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import * as path from 'path';

export class CodeGeneratorAgent extends BaseAgent implements ISpecializedAgent {
  name = 'CodeGeneratorAgent';
  description = 'Generates code based on specifications and requirements';

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService
  ) {
    super(logger);
  }

  validateInput(context: IAgentContext): boolean {
    return this.validateContext(context) && !!context.metadata?.specification;
  }

  async preProcess(context: IAgentContext): Promise<IAgentContext> {
    this.log('Pre-processing code generation request');
    return context;
  }

  async execute(context: IAgentContext): Promise<string> {
    if (!this.validateInput(context)) {
      throw new Error('Invalid input for code generation');
    }

    this.log('Generating code files');
    
    try {
      const specification = context.metadata?.specification as string;
      const workspaceRoot = context.workspaceRoot;

      // Generate main code file
      const codePrompt = `Generate production-ready TypeScript code based on this specification: ${specification}. Return only the code without explanations.`;
      const generatedCode = await this.llmService.generateText(codePrompt);
      
      const codeFilePath = path.join(workspaceRoot, 'generated', 'index.ts');
      await this.fileService.createFile(codeFilePath, generatedCode);
      this.log(`Code file created: ${codeFilePath}`);

      // Generate interfaces/types
      const typesPrompt = `Generate TypeScript interfaces and types for this specification: ${specification}. Return only the type definitions.`;
      const generatedTypes = await this.llmService.generateText(typesPrompt);
      
      const typesFilePath = path.join(workspaceRoot, 'generated', 'types.ts');
      await this.fileService.createFile(typesFilePath, generatedTypes);
      this.log(`Types file created: ${typesFilePath}`);

      return await this.postProcess(`Generated code files for: ${specification}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Code generation error: ${errorMsg}`, 'error');
      throw error;
    }
  }

  async postProcess(output: string): Promise<string> {
    this.log('Post-processing generated code');
    return output;
  }
}
