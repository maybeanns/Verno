import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';

export class ConflictResolverAgent extends BaseAgent {
  name = 'conflict-resolver';
  description = 'Resolves multi-agent code edit conflicts on the same file via LLM merge.';

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
  }

  /**
   * Evaluates conflicting diffs from two different sources and attempts a semantic merge.
   */
  async execute(context: IAgentContext, fileContent?: string, patchA?: string, patchB?: string): Promise<string> {
    this.log('Running Conflict Resolver Agent');
    
    if (!fileContent || !patchA || !patchB) {
      return 'Missing required parameters for conflict resolution.';
    }

    const prompt = `
You are an expert Git Merge Conflict Resolver.
Two different AI agents have attempted to modify the same file.

Original File Content:
${fileContent}

Diff/Proposal A (e.g. from DeveloperAgent):
${patchA}

Diff/Proposal B (e.g. from SecurityAgent):
${patchB}

Resolve the conflict cleanly by applying the logical intent of both proposals where possible. If they are fundamentally incompatible, favor the security-oriented changes.
Return ONLY the final merged TypeScript/JavaScript content for the file. No markdown block wrappings if possible, just raw code.
    `;

    try {
      const resolvedContent = await this.llmService.generateText(prompt);
      const cleanContent = resolvedContent.replace(/^```(typescript|javascript|ts|js)?\n|\n```$/g, '');
      
      // In a real execution, we'd write this resolved content back to the file
      if (context.workspaceRoot && context.filePath) {
        // this.fileService.createFile(...)
        this.changeTracker.recordChange(`${context.workspaceRoot}/${context.filePath}`, cleanContent);
      }
      
      this.log('Conflict resolution successful.');
      return cleanContent;
    } catch (err) {
      this.log(`Conflict resolution failed: ${err}`, 'error');
      // Fallback: return patch A if merge fails.
      return patchA;
    }
  }
}
