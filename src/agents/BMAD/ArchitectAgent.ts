import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';
import { FeedbackService, IssueSeverity } from '../../services/feedback';

/**
 * Enhanced Architect Agent with Feedback Capabilities
 * Generates system architecture and provides feedback on design decisions
 */
export class ArchitectAgent extends BaseAgent {
  name = 'architect';
  description = 'System Architect - Technical design, architecture decisions, system scalability';
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
    this.log('Running Architect (Winston) - System Design');

    // Initialize feedback service
    if (context.workspaceRoot) {
      this.feedbackService = new FeedbackService(context.workspaceRoot);
    }

    const completedTasks: string[] = [];
    const issues: Array<{ severity: IssueSeverity; description: string; context: string }> = [];

    const previousOutputs = (context.metadata?.previousOutputs || {}) as Record<string, string>;
    const analysis = previousOutputs['analyst'] || '';

    const prompt = `You are Winston, a senior system architect.
User Request: ${context.metadata?.userRequest || 'design system architecture'}

CONTEXT:
${analysis.substring(0, 8000)}

Provide a CONCISE, HIGH-LEVEL architecture design in markdown.
Focus on:
- System Modules & Responsibilities
- Tech Stack Recommendation (Why?)
- Data Flow (Briefly)

REQUIREMENT:
1. Include standard Mermaid diagrams (\`\`\`mermaid) to visualize the architecture. At a minimum, include a System/Component diagram. Include a Sequence or ER diagram if applicable.
2. Formalize any major architectural decisions inside your output using MADR (Markdown Architecture Decision Records) blocks formatted exactly like:
   ===ADR===
   Title: [Title]
   Context: [Context]
   Decision: [Decision]
   Consequences: [Consequences]
   ===END_ADR===

DO NOT generate generic explanations of what "scalability" means.
DO NOT use large ASCII art unless critical.
Keep it technical and dense.`;

    let buffer = '';
    try {
      await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
        buffer += token;
      });
      completedTasks.push('Completed system architecture design');
      completedTasks.push('Evaluated technology stack');
    } catch (error) {
      issues.push({
        severity: 'critical',
        description: 'Architecture generation failed',
        context: `Error: ${error}`
      });
    }

    // Parse ADRs and write architecture to file
    if (context.workspaceRoot) {
      const archPath = `${context.workspaceRoot}/ARCHITECTURE.md`;
      try {
        let archContent = buffer;
        const adrRegex = /===ADR===\s*Title:\s*(.*?)\s*Context:\s*(.*?)\s*Decision:\s*(.*?)\s*Consequences:\s*(.*?)\s*===END_ADR===/gs;
        let match;
        let adrCount = 1;
        
        const adrSummaries: string[] = [];

        while ((match = adrRegex.exec(buffer)) !== null) {
          const title = match[1].trim();
          const contextText = match[2].trim();
          const decision = match[3].trim();
          const consequences = match[4].trim();
          
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const paddedCount = adrCount.toString().padStart(4, '0');
          const fileName = `${paddedCount}-${slug}.md`;
          const adrPath = `${context.workspaceRoot}/docs/architecture/decisions/${fileName}`;
          
          const madrContent = `# ${title}\n\n## Context and Problem Statement\n${contextText}\n\n## Decision\n${decision}\n\n## Consequences\n${consequences}\n`;
          
          await this.fileService.createFile(adrPath, madrContent);
          this.changeTracker.recordChange(adrPath, madrContent);
          this.log(`ADR saved to ${adrPath}`);
          completedTasks.push(`Saved ADR ${fileName}`);
          
          adrSummaries.push(`- [${title}](docs/architecture/decisions/${fileName})`);
          adrCount++;
        }
        
        // Strip out the ADR blocks from the main architecture document
        archContent = archContent.replace(/===ADR===[\s\S]*?===END_ADR===/g, '');
        
        if (adrSummaries.length > 0) {
          archContent += `\n## Architecture Decision Records\n\n${adrSummaries.join('\n')}\n`;
        }

        await this.fileService.createFile(archPath, archContent.trim());
        this.changeTracker.recordChange(archPath, archContent.trim());
        this.log(`Architecture saved to ${archPath}`);
        completedTasks.push(`Saved architecture to ${archPath}`);
      } catch (err) {
        this.log(`Failed to write architecture: ${err}`, 'error');
        issues.push({
          severity: 'high',
          description: 'Failed to write architecture file',
          context: `Error: ${err}`
        });
      }
      
      // OpenAPI Contract Generation
      const combinedText = `${analysis} ${context.metadata?.userRequest || ''}`.toLowerCase();
      if (combinedText.includes('api') || combinedText.includes('rest') || combinedText.includes('endpoint') || combinedText.includes('http')) {
        this.log('API requirements detected, generating OpenAPI 3.1 contract...');
        const apiPrompt = `Based on the following architecture context, generate ONLY a valid OpenAPI 3.1 YAML specification. No markdown wrapping, no explanation, just raw YAML.
        
ARCHITECTURE:
${buffer.substring(0, 8000)}`;

        try {
          const apiYaml = await this.llmService.generateText(apiPrompt);
          // Strip any markdown fences if the LLM adds them
          const cleanYaml = apiYaml.replace(/^\s*```yaml\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
          
          const apiPath = `${context.workspaceRoot}/docs/api/openapi.yaml`;
          
          await this.fileService.createFile(apiPath, cleanYaml);
          this.changeTracker.recordChange(apiPath, cleanYaml);
          this.log(`OpenAPI contract saved to ${apiPath}`);
          completedTasks.push(`Saved OpenAPI contract to ${apiPath}`);
        } catch (apiErr) {
          this.log(`Failed to generate OpenAPI contract: ${apiErr}`, 'error');
          issues.push({
            severity: 'medium',
            description: 'Failed to generate OpenAPI contract',
            context: `Error: ${apiErr}`
          });
        }
      }
    }

    // Generate feedback
    if (this.feedbackService) {
      this.feedbackService.createFeedback(
        'ArchitectAgent',
        completedTasks,
        ['UX design review', 'Security audit'],
        issues,
        ['Consider microservices for scalability', 'Add caching layer'],
        ['Proceed to UX design', 'Review with security team']
      );
    }

    return buffer;
  }
}
