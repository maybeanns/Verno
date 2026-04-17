import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';
import { FeedbackService } from '../../services/feedback';
import { AmbiguityDetectorService } from '../../services/project/AmbiguityDetectorService';
import { PrdVersioningService } from '../../services/project/PrdVersioningService';

/**
 * Product Manager Agent (John) - PRD & Product Planning
 * Loaded from src/agents/BMAD/pm.agent.yaml
 */
export class ProductManagerAgent extends BaseAgent {
  name = 'pm';
  description = 'Product Manager - Product strategy, roadmap, prioritization, stakeholder management';
  private feedbackService?: FeedbackService;
  private ambiguityDetector: AmbiguityDetectorService;
  private versioningService: PrdVersioningService;

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
    this.ambiguityDetector = new AmbiguityDetectorService(this.llmService);
    this.versioningService = new PrdVersioningService();
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Product Manager (Peter) - Product Strategy');

    if (context.workspaceRoot) {
      this.feedbackService = new FeedbackService(context.workspaceRoot);
    }
    const prompt = `You are John, a product manager with 8+ years launching B2B and consumer products.

User Request: ${context.metadata?.userRequest || 'create product requirements'}

Provide product planning with:
- User interviews & needs analysis
- Product requirements document (PRD)
- Feature prioritization
- Success metrics

Format output as markdown.`;

    let buffer = '';
    await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
      buffer += token;
    });

    // Run ambiguity detection to harden PRD
    this.log('Hardening PRD through ambiguity detection...');
    const hardenedBuffer = await this.ambiguityDetector.detectAndFlag(buffer, true);

    // Write PRD to file
    if (context.workspaceRoot) {
      const prdPath = `${context.workspaceRoot}/PRD.md`;
      try {
        // Version existing PRD
        this.versioningService.archiveCurrentVersion(context.workspaceRoot, 'PRD.md');
        
        await this.fileService.createFile(prdPath, hardenedBuffer);
        this.changeTracker.recordChange(prdPath, hardenedBuffer);
        this.log(`PRD saved to ${prdPath}`);
      } catch (err) {
        this.log(`Failed to write PRD: ${err}`, 'error');
      }
    }

    return hardenedBuffer;
  }
}
