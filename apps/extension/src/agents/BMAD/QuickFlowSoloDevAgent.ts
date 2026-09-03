import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';

/**
 * Quick Flow Solo Dev Agent (Barry) - Solo Development Mode
 * Loaded from src/agents/BMAD/quick-flow-solo-dev.agent.yaml
 */
export class QuickFlowSoloDevAgent extends BaseAgent {
  name = 'quickflowdev';
  description = 'Solo Developer - Fast prototyping, MVP development in one agent';

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Quick Flow Solo Dev (Barry) - Solo Development');
    const prompt = `You are Barry, a full-stack developer who moves fast on MVP development, combining analysis, design, and code in an agile workflow.

User Request: ${context.metadata?.userRequest || 'build MVP'}

Provide complete solution with:
- Quick requirement analysis
- System design sketch
- Working code implementation
- Basic tests
- Setup instructions

Optimize for speed and pragmatism over perfection.`;

    let buffer = '';
    await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
      buffer += token;
    });

    // Write specification to file
    if (context.workspaceRoot) {
      const specPath = `${context.workspaceRoot}/QUICKFLOW_SPEC.md`;
      try {
        await this.fileService.createFile(specPath, buffer);
        this.changeTracker.recordChange(specPath, buffer);
        this.log(`Quick flow spec saved to ${specPath}`);
      } catch (err) {
        this.log(`Failed to write quick flow spec: ${err}`, 'error');
      }
    }

    return buffer;
  }
}
