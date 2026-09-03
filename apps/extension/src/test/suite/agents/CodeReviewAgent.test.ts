import * as assert from 'assert';
import * as sinon from 'sinon';
import { CodeReviewAgent } from '../../../agents/BMAD/CodeReviewAgent';
import { LLMService } from '../../../services/llm';
import { FileService } from '../../../services/file/FileService';
import { FileChangeTracker } from '../../../services/file/FileChangeTracker';

suite('CodeReviewAgent Tests', () => {
    let agent: CodeReviewAgent;
    let mockLogger: any;
    let llmService: LLMService;
    let fileService: FileService;
    let changeTracker: FileChangeTracker;

    setup(() => {
        mockLogger = { info: () => { }, warn: () => { }, error: () => { } };
        llmService = new LLMService();
        fileService = new FileService();
        changeTracker = new FileChangeTracker();

        // Provide a mock provider that returns canned review responses
        const mockProvider: any = {
            initialize: async () => { },
            generateText: async () => 'ISSUES: None\nVERDICT: PASS\nSUGGESTIONS: None',
            streamGenerate: async (_prompt: string, _opts: any, onToken: (t: string) => void) => {
                onToken('mock review output');
            },
            getModelInfo: () => ({})
        };
        llmService.setProvider(mockProvider);

        agent = new CodeReviewAgent(mockLogger, llmService, fileService, changeTracker);
    });

    test('detects skeleton code with empty function bodies', () => {
        const files = [
            {
                name: 'routes.ts',
                content: `
import express from 'express';
const router = express.Router();
router.post('/signup', async (req, res) => { });
export default router;
`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        assert.ok(issues.length > 0, 'Should detect empty function body');
        assert.ok(
            issues.some(i => i.severity === 'critical'),
            'Empty function body should be critical severity'
        );
    });

    test('detects skeleton code with TODO comments', () => {
        const files = [
            {
                name: 'controller.ts',
                content: `
export class UserController {
  async createUser(req: Request, res: Response) {
    // TODO: implement user creation
    res.send('ok');
  }
}
`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        assert.ok(issues.length > 0, 'Should detect TODO placeholder');
        assert.ok(
            issues.some(i => i.description.includes('placeholder comment')),
            'Should identify placeholder comment issue'
        );
    });

    test('detects skeleton code with "implement" placeholder comments', () => {
        const files = [
            {
                name: 'service.ts',
                content: `
export const signUpController = {
  createUser: async (req, res) => {
    // Code for handling user sign-up
  },
};
`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        assert.ok(issues.length > 0, 'Should detect "Code for handling" placeholder');
    });

    test('passes complete code with real implementations', () => {
        const files = [
            {
                name: 'userController.ts',
                content: `
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ email, password: hashedPassword, name });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    return res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        assert.strictEqual(issues.length, 0, `Expected no issues but found: ${JSON.stringify(issues)}`);
    });

    test('detects suspiciously short files', () => {
        const files = [
            {
                name: 'utils.ts',
                content: `export const a = 1;`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        assert.ok(
            issues.some(i => i.description.includes('Suspiciously short')),
            'Should flag very short files'
        );
    });

    test('ignores short JSON files', () => {
        const files = [
            {
                name: '.env',
                content: `PORT=3000`
            }
        ];

        const issues = agent.detectSkeletonCode(files);
        const shortFileIssues = issues.filter(i => i.description.includes('Suspiciously short'));
        assert.strictEqual(shortFileIssues.length, 0, '.env files should not be flagged as suspicious');
    });

    test('execute returns review report', async () => {
        const context = {
            workspaceRoot: '/mock/workspace',
            metadata: {
                userRequest: 'build a signup page',
                previousOutputs: {
                    developer: '```FILE: server.ts\nimport express from "express";\nconst app = express();\napp.get("/", (req, res) => { res.send("Hello"); });\napp.listen(3000);\n```'
                }
            }
        } as any;

        sinon.stub(agent as any, 'checkCompilation').resolves('TypeScript compilation: PASSED');
        sinon.stub(agent as any, 'checkTests').resolves('Tests: PASSED');
        sinon.stub(agent as any, 'scanDirectoryForCode').returns([]);

        const result = await agent.execute(context);
        assert.ok(result.includes('Code Review Report'), 'Should produce a review report');
        assert.ok(result.includes('Verdict'), 'Report should include a verdict');
    });
});
