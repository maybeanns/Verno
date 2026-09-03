import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';
import { FeedbackService, IssueSeverity } from '../../services/feedback';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as util from 'util';

const exec = util.promisify(childProcess.exec);

/**
 * Enhanced QA Engineer Agent with Feedback Capabilities
 * Generates test plans, test cases, and quality assurance strategies
 */
export class QAEngineerAgent extends BaseAgent {
  name = 'qa';
  description = 'QA Engineer - Test strategy, test case development, quality assurance';
  private feedbackService?: FeedbackService;

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running QA Engineer (Oliver) - Quality Assurance');

    // Initialize feedback service
    if (context.workspaceRoot) {
      this.feedbackService = new FeedbackService(context.workspaceRoot);
    }

    const completedTasks: string[] = [];
    const issues: Array<{ severity: IssueSeverity; description: string; context: string }> = [];

    const previousOutputs = (context.metadata?.previousOutputs || {}) as Record<string, string>;
    const implementation = previousOutputs['developer'] || '';
    const uxDesign = previousOutputs['uxdesigner'] || '';

    const hasUx = uxDesign.trim().length > 0;

    const prompt = `You are Oliver, a senior QA engineer specializing in test strategy and automated test code generation.

User Request: ${context.metadata?.userRequest || 'create test plan'}

CONTEXT FROM DEVELOPER:
${implementation.substring(0, 8000)}

${hasUx ? `CONTEXT FROM UX DESIGNER (Contains UI scenarios that need E2E coverage):\n${uxDesign.substring(0, 3000)}\n` : ''}
RULES:
1. Provide a brief test strategy.
2. For each major component/module in the Developer Context, generate the exact implementation logic for unit tests. YOU MUST OUTPUT valid per-file test stubs using the "FILE:" block format.
${hasUx ? `3. You detect UX designs. YOU MUST generate a Playwright E2E spec under \`tests/e2e/workflow.spec.ts\` and scaffold a basic \`playwright.config.ts\` if it's missing.\n` : ''}

OUTPUT FORMAT (MANDATORY for code):
\`\`\`FILE: path/to/file.spec.ts
...test code...
\`\`\`

You MUST use the exact FILE block format for any valid test scripts.`;

    let buffer = '';
    try {
      await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
        buffer += token;
      });
      completedTasks.push('Developed test strategy');
      completedTasks.push('Created test cases');
    } catch (error) {
      issues.push({
        severity: 'critical',
        description: 'Test plan generation failed',
        context: `Error: ${error}`
      });
    }

    // Parse explicitly generated test files
    let generatedFiles: Array<{ name: string; content: string }> = [];
    if (context.workspaceRoot) {
      generatedFiles = this.parseCodeFiles(buffer);
      this.log(`Parsed ${generatedFiles.length} test files from LLM output`);
      
      for (const file of generatedFiles) {
        try {
          const filePath = `${context.workspaceRoot}/${file.name}`;
          if (fs.existsSync(filePath)) {
            await this.fileService.updateFile(filePath, file.content, true);
          } else {
            await this.fileService.createFile(filePath, file.content);
          }
          this.changeTracker.recordChange(filePath, file.content);
          completedTasks.push(`Scaffolded test file: ${file.name}`);
        } catch (err: any) {
          issues.push({ severity: 'high', description: `Failed to write test file ${file.name}`, context: err.message });
        }
      }

      // Write QA plan metadata to file
      const qaPath = `${context.workspaceRoot}/QA_PLAN.md`;
      try {
        await this.fileService.updateFile(qaPath, buffer, true).catch(async () => await this.fileService.createFile(qaPath, buffer));
        this.changeTracker.recordChange(qaPath, buffer);
        this.log(`QA plan saved to ${qaPath}`);
        completedTasks.push(`Saved QA plan to ${qaPath}`);
      } catch (err: any) {
        issues.push({ severity: 'high', description: 'Failed to write QA plan file', context: err.message });
      }

      // Auto-trigger test execution locally after scaffold mapping
      if (fs.existsSync(`${context.workspaceRoot}/package.json`)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(`${context.workspaceRoot}/package.json`, 'utf-8'));
          if (packageJson.scripts && packageJson.scripts.test) {
            this.log('Executing test suite verification loop...');
            const { stdout } = await exec('npm test', { cwd: context.workspaceRoot, timeout: 60000 });
            this.log(`npm test passed.\n${stdout}`);
            completedTasks.push('Verified auto-generated unit tests via npm test (Pass)');
          } else {
            issues.push({ severity: 'medium', description: 'npm test script missing', context: 'Could not auto-verify unit tests because no test script exists inside package.json.' });
          }
        } catch (err: any) {
             this.log(`npm test failed: ${err.message}`, 'warn');
             issues.push({ severity: 'high', description: 'Unit test suite execution failed', context: err.message });
        }
      }
    }

    // Generate feedback
    if (this.feedbackService) {
      this.feedbackService.createFeedback(
        'QAEngineerAgent',
        completedTasks,
        ['Execute test cases', 'Set up CI/CD pipeline'],
        issues,
        ['Add automated regression tests', 'Implement test coverage tracking'],
        ['Execute tests', 'Report results to team']
      );
    }

    return buffer;
  }

  private parseCodeFiles(content: string): Array<{ name: string; content: string }> {
    const files: Array<{ name: string; content: string }> = [];
    const splitRegex = /(?:^|\n)(?:FILE|EDIT):\s*([^\n]+)\s*\n+\s*```(?:\w+)?\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = splitRegex.exec(content)) !== null) {
      const filename = match[1].trim();
      const filecontent = match[2].trim();
      if (filename && filecontent && !files.some(f => f.name === filename)) {
        files.push({ name: filename, content: filecontent });
      }
    }
    
    const inlineRegex = /```(?:FILE|EDIT):\s*([^\n]+)\n([\s\S]*?)```/g;
    while ((match = inlineRegex.exec(content)) !== null) {
      const filename = match[1].trim();
      const filecontent = match[2].trim();
      if (filename && filecontent && !files.some(f => f.name === filename)) {
        files.push({ name: filename, content: filecontent });
      }
    }

    return files;
  }
}
