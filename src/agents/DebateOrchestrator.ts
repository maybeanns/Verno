/**
 * DebateOrchestrator — 8-agent multi-round PRD debate engine.
 *
 * Agents:
 *  1. analyst      — Business requirements, KPIs, user value
 *  2. architect    — Backend scalability, data models, API design
 *  3. ux           — User flows, interfaces, accessibility
 *  4. developer    — Code structure, technical feasibility, components
 *  5. pm           — Scope, milestones, prioritization
 *  6. qa           — Edge cases, testability, test plans
 *  7. techwriter   — Documentation, readability, API references
 *  8. security     — OWASP Top 10, GDPR/HIPAA, threat modeling  ← new in Phase 3
 *
 * The security agent shifts vulnerability discovery LEFT — catching
 * compliance requirements and attack surface concerns at the PRD stage,
 * before a single line of code is written.
 */

import * as vscode from 'vscode';
import { DebateMessage, PRDDocument, PRDSection } from '../types/sdlc';
import { LLMService } from '../services/llm';
import { Logger } from '../utils/logger';
import { VernoArtifactService } from '../services/artifact/VernoArtifactService';
import { SecurityComplianceService } from '../services/project/SecurityComplianceService';

// ─── Agent definitions ────────────────────────────────────────────────────────

const DEBATE_AGENTS = [
    { id: 'analyst', role: 'Business Analyst (Focus on business requirements, KPIs, and user value)' },
    { id: 'architect', role: 'System Architect (Focus on backend scalability, data models, and API design)' },
    { id: 'ux', role: 'UX Designer (Focus on user flows, interfaces, and accessibility)' },
    { id: 'developer', role: 'Developer (Focus on code structure, technical feasibility, and components)' },
    { id: 'pm', role: 'Product Manager (Focus on scope, milestones, and prioritization)' },
    { id: 'qa', role: 'QA Engineer (Focus on edge cases, testability, and test plans)' },
    { id: 'techwriter', role: 'Technical Writer (Focus on documentation, readability, and API references)' },
    {
        id: 'security',
        role: 'Security Engineer (Focus on OWASP Top 10 attack vectors, authentication and authorization design, data classification (PII/PHI), GDPR/HIPAA compliance requirements, secret management, and threat modeling for all proposed features)'
    },
] as const;

// ─── DebateOrchestrator ───────────────────────────────────────────────────────

export class DebateOrchestrator {
    private llmService: LLMService;
    private logger: Logger;
    private securityService: SecurityComplianceService;

    constructor(llmService: LLMService, logger: Logger) {
        this.llmService = llmService;
        this.logger = logger;
        this.securityService = new SecurityComplianceService();
    }

    // ── Public ──────────────────────────────────────────────────────────────

    public async runDebate(
        topic: string,
        onMessage: (msg: DebateMessage) => void,
        previousMessages: DebateMessage[] = [],
        cancellationToken?: vscode.CancellationToken
    ): Promise<PRDDocument> {
        this.logger.info(`[DebateOrchestrator] Starting 8-agent debate: "${topic}"`);

        let history = [...previousMessages];
        const numRounds = 3;

        // ── Phase A: Multi-round debate ────────────────────────────────────
        for (let round = 1; round <= numRounds; round++) {
            if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
            this.logger.info(`  Round ${round}/${numRounds}`);
            for (const agent of DEBATE_AGENTS) {
                if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
                const prompt = this.buildPrompt(topic, agent.id, agent.role, history, round);
                const response = await this.llmService.generateText(prompt);

                const msg: DebateMessage = {
                    agentId: agent.id,
                    content: response.trim(),
                    round,
                    timestamp: Date.now(),
                    type: round === 1 ? 'argument' : 'counter',
                };
                history.push(msg);
                onMessage(msg);
            }
        }

        // ── Phase B: Convergence / PM consensus ───────────────────────────
        if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
        this.logger.info('  Convergence phase');
        const convergencePrompt = `You are the Product Manager who has chaired the debate.
The 3-round debate among the 8 BMAD agents (including the Security Engineer) has concluded.
Original Topic: ${topic}

Full Debate Transcript:
${history.map(m => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n')}

Synthesize the debate into a single executive consensus. Resolve disagreements authoritatively.
Include any security concerns and compliance requirements raised by the Security Engineer.
Keep it concise but authoritative (max 250 words).`;

        const convergenceResponse = await this.llmService.generateText(convergencePrompt);
        const convergenceMsg: DebateMessage = {
            agentId: 'pm',
            content: convergenceResponse.trim(),
            round: numRounds + 1,
            timestamp: Date.now(),
            type: 'consensus',
        };
        history.push(convergenceMsg);
        onMessage(convergenceMsg);

        // ── Phase C: PRD generation ────────────────────────────────────────
        if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
        this.logger.info('  PRD generation');
        const prdPrompt = `You are a Technical Product Manager. Based on the following debate and executive summary, generate a formal Product Requirements Document (PRD).

Original Topic: ${topic}

Debate History & Consensus:
${history.map(m => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n')}

Respond ONLY with valid JSON — an array of section objects. No markdown fences. No keys other than "title" and "content".

Required sections (in this order):
[
  { "title": "Overview", "content": "Executive summary of the feature/product" },
  { "title": "Problem Statement", "content": "The specific problem being solved and user pain points" },
  { "title": "Goals & Non-Goals", "content": "What success looks like and what is explicitly out of scope" },
  { "title": "User Stories", "content": "User stories in 'As a <role>, I want <capability> so that <benefit>' format" },
  { "title": "Technical Specifications", "content": "Architecture decisions, API contracts, data models, integrations" },
  { "title": "Security & Compliance", "content": "MUST include: (1) OWASP Top 10 checklist items relevant to this feature, (2) Data classification (PII/PHI present?), (3) GDPR consent requirements if personal data is collected, (4) HIPAA requirements if health data is processed, (5) Threat model summary, (6) Required security controls and mitigations" },
  { "title": "Acceptance Criteria", "content": "Testable, measurable conditions that define feature completeness" },
  { "title": "Risks & Mitigations", "content": "Technical, business, and security risks with mitigation strategies" }
]`;

        let prdJson = await this.llmService.generateText(prdPrompt);

        // Robust JSON extraction: look for the start of the array
        const jsonMatch = prdJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            prdJson = jsonMatch[0];
        } else {
            prdJson = prdJson.replace(/```json/gi, '').replace(/```/g, '').trim();
        }

        let sections: PRDSection[] = [];
        try {
            sections = JSON.parse(prdJson);
        } catch (e) {
            this.logger.error('Failed to parse PRD JSON, using fallback', e as Error);
            sections = [{
                title: 'Overview and Synthesis',
                content: convergenceResponse,
                complianceFlags: []
            }];
        }

        // ── Phase D: Security & Compliance pass ───────────────────────────
        sections = this.securityService.applySecurityPass(sections);

        const prdDocument: PRDDocument = {
            title: `PRD: ${topic.substring(0, 80)}`,
            sections,
            status: 'draft',
        };

        this.writePRDToFile(prdDocument);
        this.logger.info(`[DebateOrchestrator] PRD complete — ${sections.length} sections`);

        return prdDocument;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Build an agent-specific debate prompt.
     * The security agent gets a hardened prompt that probes for attack vectors,
     * data classification needs, and compliance requirements.
     */
    private buildPrompt(
        topic: string,
        agentId: string,
        role: string,
        history: DebateMessage[],
        round: number
    ): string {
        const historyText = history.length === 0
            ? 'No prior messages.'
            : history.map(m => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n');

        const baseInstruction = round === 1
            ? 'State your initial perspective, identifying key priorities and potential challenges from your domain.'
            : 'Respond to your colleagues\' points. Defend your domain\'s needs, suggest compromises, or highlight issues in their proposals.';

        const securityAddendum = agentId === 'security'
            ? `
As Security Engineer, ALWAYS address:
1. What attack vectors exist in the proposed feature? (reference OWASP Top 10 categories)
2. Does this feature collect or process PII or health data? (flag for GDPR/HIPAA)
3. What authentication and authorization model is required?
4. Are there any insecure defaults, hardcoded secrets, or misconfiguration risks?
5. What threat model applies (spoofing, tampering, repudiation, info disclosure, DoS, elevation)?
Be specific and non-negotiable on security requirements.`
            : '';

        return `You are the ${role} in a team debate on:
Topic: ${topic}

Debate history so far:
${historyText}

This is Round ${round}. ${baseInstruction}${securityAddendum}

Keep your response under 150 words. Be direct, professional, and represent your role's priorities firmly.`;
    }

    /**
     * Write PRD to `.verno/PRD.md` with compliance flag badges rendered inline.
     */
    private writePRDToFile(prd: PRDDocument): void {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) { return; }

        const artifacts = new VernoArtifactService(root);

        let md = `# ${prd.title}\n\n`;
        md += `> **Status:** ${prd.status.toUpperCase()} — Generated by Verno SDLC Engine\n\n`;
        md += `---\n\n`;

        for (const section of prd.sections) {
            md += `## ${section.title}\n\n${section.content}\n\n`;

            if (section.complianceFlags && section.complianceFlags.length > 0) {
                md += `> **Compliance Flags:**\n`;
                for (const flag of section.complianceFlags) {
                    md += `> - ${flag}\n`;
                }
                md += '\n';
            }

            md += '---\n\n';
        }

        artifacts.write('PRD.md', md);
        artifacts.writeJSON('prd.json', prd);
        this.logger.info(`[DebateOrchestrator] PRD written to .verno/PRD.md and .verno/prd.json`);
    }
}
