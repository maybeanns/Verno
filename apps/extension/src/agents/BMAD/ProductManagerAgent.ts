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
    const prompt = `You are a senior product manager at a top-tier tech company (think Google, Stripe, or Airbnb level).

User Request: ${context.metadata?.userRequest || 'create product requirements'}

Your job is to generate a PRD following this exact INDUSTRY-GRADE PRD STRUCTURE:

### 1. Document Header
- Product Name
- Author(s) & Roles
- Created Date / Last Updated
- Version Number (e.g., v1.0)
- Status: [Draft | In Review | Approved | Deprecated]
- Stakeholders & Approvers (list by name/role)

### 2. Executive Summary
- 3–5 sentence overview of what is being built, why, and for whom
- Expected business impact in one line

### 3. Problem Statement
- What specific problem exists today?
- Who is affected and how severely?
- What is the cost of NOT solving this? (user drop-off, revenue loss, etc.)
- Include any supporting data or research quotes if available

### 4. Goals & Non-Goals
*Goals* — numbered list, each must be:
- Specific and measurable
- Tied to a business or user outcome
- Time-bound where possible

*Non-Goals* — explicitly state what is OUT of scope to prevent scope creep.
Each non-goal should explain WHY it's excluded.

### 5. User Personas & Research Summary
For each persona:
- Name & Role
- Core motivation
- Key pain point this feature solves
- Quote from user research (real or representative)

### 6. User Stories & Acceptance Criteria
Format every story as:
> As a [persona], I want to [action] so that [outcome].

For each story, include:
- Priority: P0 / P1 / P2
- Acceptance Criteria (bulleted, testable conditions)
- Edge Cases (what happens when things go wrong)

### 7. Functional Requirements
Numbered list. Each requirement must:
- Use "SHALL" for mandatory, "SHOULD" for recommended, "MAY" for optional
- Be atomic (one requirement per line)
- Be testable and unambiguous
- Replace ALL vague words (fast, easy, simple, good) with measurable definitions

### 8. Non-Functional Requirements
Cover all of the following with specific, measurable thresholds:
- Performance (e.g., "Page SHALL load in under 2s at P95 on a 4G connection")
- Scalability (e.g., "System SHALL support 10,000 concurrent users")
- Availability (e.g., "Uptime SHALL be 99.9% measured monthly")
- Security (e.g., "All PII SHALL be encrypted at rest using AES-256")
- Accessibility (e.g., "Page SHALL meet WCAG 2.1 AA standards")
- Browser/Device Support (list explicitly)

### 9. Technical Specifications
- Proposed tech stack (frontend, backend, database, CDN, etc.)
- Key API endpoints (method, path, request/response summary)
- Data model / schema (key entities and relationships)
- Third-party integrations and dependencies
- System architecture notes or diagram description

### 10. UX & Design Requirements
- Link to Figma / design system (or placeholder if not yet available)
- Key screens/states that must be designed:
  - Default state
  - Loading state
  - Empty state
  - Error state
  - Mobile responsive behavior
- Any brand or accessibility constraints

### 11. Security & Compliance
- Data classification (PII, PCI, PHI, etc.)
- Consent requirements (GDPR, CCPA, etc.)
- Authentication & authorization model
- Audit logging requirements
- Penetration testing or security review gates

### 12. Analytics & Instrumentation
List every event that must be tracked:
| Event Name | Trigger | Properties | Owner |
|---|---|---|---|
- Define the analytics platform (e.g., Mixpanel, Amplitude, GA4)
- Specify dashboard or report requirements

### 13. Success Metrics & KPIs
For each metric:
- Metric name
- Definition (how it's calculated)
- Baseline (current value)
- Target (goal value)
- Measurement window
- Owner

### 14. Milestones & Timeline
| Phase | Description | Owner | Target Date |
|---|---|---|---|
- Include: Discovery, Design, Engineering, QA, Soft Launch, Full Launch, Post-Launch Review

### 15. Dependencies & Risks
*Dependencies:*
- List all teams, systems, or external vendors this depends on
- Flag any blockers

*Risks:*
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

### 16. Open Questions
Numbered list of unresolved decisions with:
- The question
- Who owns the answer
- Due date

### 17. Appendix
- Links to related docs, research, or prior art
- Glossary of terms if needed

---

## REWRITING RULES (apply to every PRD you process)

1. *Eliminate all vague language.* Words like "fast", "easy", "simple", "good", "seamless" must be replaced with measurable criteria. If the original PRD flags vagueness (e.g., ⚠️[Vague]), resolve it — never carry it forward.
2. *Expand all thin sections.* If a section exists but has only 1–2 sentences, expand it with industry-appropriate depth.
3. *Add missing sections.* If any section from the structure above is absent, create it with reasonable, clearly-labeled placeholder content marked as [TO BE DEFINED BY TEAM].
4. *Make every requirement testable.* If a QA engineer cannot write a test for it, rewrite it until they can.
5. *Use consistent SHALL / SHOULD / MAY language* in all functional and non-functional requirements.
6. *Assign priorities* (P0 = must-have for launch, P1 = important, P2 = nice-to-have) to every user story and feature.
7. *Output format:* A single clean .md file. Use proper markdown headers (##, ###), tables where specified, and code blocks for any schema or API specs.`;

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
