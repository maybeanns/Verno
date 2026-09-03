/**
 * Test generator agent for creating unit and integration tests
 */

import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { ISpecializedAgent } from '../../types/agents';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { PlaywrightScaffoldService } from '../../services/project/PlaywrightScaffoldService';
import * as path from 'path';
import * as fs from 'fs';

export class TestGeneratorAgent extends BaseAgent implements ISpecializedAgent {
  name = 'TestGeneratorAgent';
  description = 'Generates unit and integration tests for code';
  private playwrightService: PlaywrightScaffoldService;

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService
  ) {
    super(logger);
    this.playwrightService = new PlaywrightScaffoldService(llmService, fileService);
  }

  validateInput(context: IAgentContext): boolean {
    return this.validateContext(context) && (!!context.filePath || !!context.metadata?.codeAnalysis);
  }

  async preProcess(context: IAgentContext): Promise<IAgentContext> {
    this.log('Pre-processing test generation request');
    return context;
  }

  async execute(context: IAgentContext): Promise<string> {
    if (!this.validateInput(context)) {
      throw new Error('Invalid input for test generation');
    }

    this.log('Generating tests');
    
    try {
      const workspaceRoot = context.workspaceRoot;
      const activeFile = context.filePath;
      const fileContent = context.fileContent || '';

      // 1. Unit Test Generation (Logic-Aware)
      if (activeFile && fileContent) {
          const unitTestPrompt = `
          Generate comprehensive, logic-aware unit tests for this TypeScript file using the Jest framework.
          
          File: ${activeFile}
          Content:
          ${fileContent}
          
          Guidelines:
          - Analyze the internal logic and conditional branches of all functions.
          - Generate assertions for happy paths, edge cases, and potential error states.
          - Use appropriate mocks for external dependencies.
          - Return ONLY the TypeScript code for the test.
          `;

          const unitTests = await this.llmService.generateText(unitTestPrompt);
          
          // Determine path: neighbor or __tests__
          const fileDir = path.dirname(path.join(workspaceRoot, activeFile));
          const fileName = path.basename(activeFile, path.extname(activeFile));
          
          let testDir = fileDir;
          const localTestsDir = path.join(fileDir, '__tests__');
          if (fs.existsSync(localTestsDir)) {
              testDir = localTestsDir;
          }

          const unitTestPath = path.join(testDir, `${fileName}.test.ts`);
          await this.fileService.createFile(unitTestPath, unitTests);
          this.log(`Unit tests created: ${unitTestPath}`);
      }

      // 2. E2E Scaffolding (if requested or by default in this phase)
      if (context.metadata?.generateE2E) {
          this.log('Scaffolding Playwright E2E tests...');
          await this.playwrightService.generateE2ETests(context);
      }

      return await this.postProcess('Test generation complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Test generation error: ${errorMsg}`, 'error');
      throw error;
    }
  }

  async postProcess(output: string): Promise<string> {
    this.log('Post-processing generated tests');
    return output;
  }
}
