import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import * as path from 'path';
import * as fs from 'fs';

export class PlaywrightScaffoldService {
    constructor(
        private llmService: LLMService,
        private fileService: FileService
    ) {}

    /**
     * Generates Playwright E2E test scripts based on user flows in REQUIREMENTS.md.
     */
    async generateE2ETests(context: IAgentContext): Promise<string[]> {
        const workspaceRoot = context.workspaceRoot;
        const requirementsPath = path.join(workspaceRoot, '.planning', 'REQUIREMENTS.md');
        
        let requirementsContext = '';
        if (fs.existsSync(requirementsPath)) {
            requirementsContext = fs.readFileSync(requirementsPath, 'utf8');
        }

        const prompt = `
        You are a QA Automation Engineer. Based on the following project requirements and user flows, generate a Playwright E2E test script.
        
        Requirements:
        ${requirementsContext}
        
        Current Workspace Logic Context:
        ${context.metadata?.codeAnalysis || 'General workspace flows'}
        
        Guidelines:
        - Use Page Object Model (POM) patterns where suggested.
        - Include setup and teardown logic.
        - Focus on happy paths derived from Acceptance Criteria.
        - Return ONLY the TypeScript code for the test.
        `;

        const testCode = await this.llmService.generateText(prompt);
        
        const testDir = path.join(workspaceRoot, 'tests', 'e2e');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const testPath = path.join(testDir, 'app.spec.ts');
        await this.fileService.createFile(testPath, testCode);

        return [testPath];
    }
}
