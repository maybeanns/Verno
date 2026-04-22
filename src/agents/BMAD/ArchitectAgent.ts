import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';
import { FeedbackService, IssueSeverity } from '../../services/feedback';
import { MermaidRenderService } from '../../services/documentation/MermaidRenderService';

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

    const prompt = `You are a principal software architect at a top-tier tech company (think AWS, Netflix, or Shopify level).

User Request: ${context.metadata?.userRequest || 'design system architecture'}

CONTEXT:
${analysis.substring(0, 8000)}

Your job is to generate a comprehensive system architecture document following this exact INDUSTRY-GRADE ARCHITECTURE DOCUMENT STRUCTURE:

### 1. Document Header
- System / Product Name
- Author(s) & Roles
- Created Date / Last Updated
- Version Number (e.g., v1.0)
- Status: [Draft | In Review | Approved | Deprecated]
- Reviewers & Approvers (list by name/role)

### 2. Executive Summary
- 3–5 sentence overview of the system being built
- Key architectural goals (e.g., scalability, maintainability, security)
- Link to related PRD or product spec

### 3. System Context & Scope
- What does this system do at a high level?
- What is explicitly OUT of scope for this architecture?
- External systems or actors this system interacts with (users, third-party APIs, payment providers, etc.)

### 4. Architecture Principles
List the guiding principles driving every decision. Examples:
- Separation of concerns
- Fail fast & recover gracefully
- Security by design
- Prefer managed services over self-hosted where possible
- Design for horizontal scalability

### 5. System Modules & Responsibilities
For each module:
- *Name*
- *Responsibility* (1–2 sentences, specific)
- *Interfaces* (what it exposes or consumes)
- *Technology* (resolved — no "X or Y" ambiguity)
- *Owner / Team* (if known)

### 6. Resolved Tech Stack
Present as a table. Every choice MUST be resolved — no "or" options.

### 7. System Architecture Diagrams
Include ALL of the following using valid Mermaid syntax.
*7a. High-Level Context Diagram (C4 Level 1)*
*7b. Container Diagram (C4 Level 2)*
*7c. Data Flow Diagram* (Must show BOTH happy path AND cache-hit path, and security checkpoints)

MERMAID RULES (CRITICAL — FOLLOW EXACTLY):
- Use \`graph LR\` or \`flowchart LR\` for architecture diagrams. NEVER use \`sequenceDiagram\` for these.
- NEVER use \`participant\` in graph/flowchart diagrams. \`participant\` is ONLY for \`sequenceDiagram\`.
- Arrow syntax: \`A -->|label| B\` (with a space before B). NEVER use \`-->|label|>\`.
- Node IDs must be camelCase with NO spaces: \`userAuth\`, \`productCatalog\`, \`paymentAPI\`.
- Use square brackets for labels: \`userAuth[User Auth Service]\`.
- Example of CORRECT syntax:
\`\`\`mermaid
graph LR
    user[User] -->|browses| frontend[Frontend SPA]
    frontend -->|REST API| apiGateway[API Gateway]
    apiGateway -->|routes| productService[Product Service]
    productService -->|queries| database[(PostgreSQL)]
\`\`\`
- For data flow, use \`sequenceDiagram\` with proper participant declarations:
\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    U->>F: Browse products
    F->>A: GET /products
    A-->>F: Product list
\`\`\`

### 8. API Contract
Include endpoint table, versioning strategy, auth mechanism, rate limiting, and error format.

### 9. Data Model
Include schema block or erDiagram.

### 10. Caching Strategy
Specify pattern, what is cached, key structure, TTL, invalidation, cold start, and eviction.

### 11. Security Architecture
Cover auth model, encryption, secrets management, input validation, OWASP mitigations, GDPR, and security headers.

### 12. Infrastructure & Deployment Architecture
Include provider, containerization, environment strategy, CI/CD, IaC, and rollback strategy. Include a deployment diagram.

### 13. Scalability & Performance
Include load expectations, scaling strategy, load balancing, DB scaling, CDN, and performance budgets.

### 14. Reliability & Error Handling
Include failure modes, fallback, retry, circuit breaker, SLA, and health checks.

### 15. Observability
Include logging, metrics, tracing, alerting, and dashboard requirements.

### 16. Architecture Decision Records (ADRs)
Minimum required ADRs: Frontend framework, Backend language, Database choice, Caching strategy, Authentication, Deployment platform.
Format each ADR as:
===ADR===
Title: [Title]
Context: [Context]
Decision: [Decision]
Consequences: [Consequences]
===END_ADR===

### 17. Open Questions & Risks
Table with Question/Risk, Owner, Due Date, and Status.

---

## REWRITING RULES (apply strictly)
1. Resolve all "X or Y" decisions.
2. Fix all Mermaid syntax errors. Correct arrow syntax (-->|label|).
3. Complete the cache flow (show read and write paths).
4. Integrate the Security Module into diagrams.
5. Populate all ADR stubs.
6. Map back to NFRs (scalability, uptime).
7. Add all failure modes.
8. Output a single clean .md file.`;

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

        // Post-process: extract Mermaid blocks and render to PNG
        try {
          const mermaidService = new MermaidRenderService(context.workspaceRoot!, this.logger);
          const diagrams = await mermaidService.processDocument(archContent, 'architecture');

          if (diagrams.length > 0) {
            let updatedContent = archContent;
            for (const diagram of diagrams) {
              if (diagram.relativePngPath) {
                // Replace raw mermaid block with image reference
                updatedContent = updatedContent.replace(
                  diagram.originalBlock,
                  `![${diagram.title}](${diagram.relativePngPath})`
                );
              }
            }
            // Re-write ARCHITECTURE.md with image references
            await this.fileService.createFile(archPath, updatedContent.trim());
            this.changeTracker.recordChange(archPath, updatedContent.trim());
            this.log(`Updated ARCHITECTURE.md with ${diagrams.length} diagram image references`);
            completedTasks.push(`Rendered ${diagrams.length} UML diagram(s) to PNG`);
          }
        } catch (mermaidErr: any) {
          this.log(`Mermaid diagram rendering failed (non-fatal): ${mermaidErr.message || mermaidErr}`, 'warn');
          issues.push({
            severity: 'low' as IssueSeverity,
            description: 'Mermaid diagram rendering failed',
            context: `Error: ${mermaidErr}`
          });
        }
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
