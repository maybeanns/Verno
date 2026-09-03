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
import { AgentEventBus, AgentProposalEvent } from './core/AgentEventBus';
import { ArbitratorAgent } from './core/ArbitratorAgent';
import { PERSONAS, personaRole } from '@verno/agents';

// ─── Agent definitions ────────────────────────────────────────────────────────

// Canonical panel lives in @verno/agents so the web app and this extension
// cannot drift apart again. See packages/agents/src/personas.ts.
const DEBATE_AGENTS = PERSONAS.map((p) => ({ id: p.id, role: personaRole(p) }));

// ─── DebateOrchestrator ───────────────────────────────────────────────────────

export class DebateOrchestrator {
    private llmService: LLMService;
    private logger: Logger;
    private securityService: SecurityComplianceService;
    private eventBus?: AgentEventBus;
    private arbitrator?: ArbitratorAgent;

    constructor(
        llmService: LLMService,
        logger: Logger,
        /** Optional: inject an AgentEventBus to enable event-driven debate mode */
        eventBus?: AgentEventBus,
    ) {
        this.llmService = llmService;
        this.logger = logger;
        this.securityService = new SecurityComplianceService();
        if (eventBus) {
            this.eventBus = eventBus;
            this.arbitrator = new ArbitratorAgent(
                eventBus,
                llmService,
                { totalAgents: DEBATE_AGENTS.length, consensusThreshold: 0.67 },
                logger,
            );
        }
    }

    // ── Public ──────────────────────────────────────────────────────────────

    public async runDebate(
        topic: string,
        onMessage: (msg: DebateMessage) => void,
        previousMessages: DebateMessage[] = [],
        cancellationToken?: vscode.CancellationToken
    ): Promise<PRDDocument> {
        this.logger.info(`[DebateOrchestrator] Starting true 8-agent round-robin debate: "${topic}"`);

        let history = [...previousMessages];
        const numRounds = 3;

        // ── Start bus-driven arbitration if a bus is injected ────────────────
        this.arbitrator?.start();

        // ── Phase A: Multi-round debate ─────────────────────────────────────
        for (let round = 1; round <= numRounds; round++) {
            if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
            this.logger.info(`  Round ${round}/${numRounds}`);

            const roundMessages: DebateMessage[] = [];

            for (const agent of DEBATE_AGENTS) {
                if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
                this.logger.info(`    Agent ${agent.id} taking turn...`);

                const agentPrompt = this.buildAgentRoundPrompt(topic, agent.id, agent.role, round, history);
                const response = await this.llmService.generateText(agentPrompt);

                const msg: DebateMessage = {
                    agentId: agent.id,
                    content: response.trim(),
                    round,
                    timestamp: Date.now(),
                    type: round === 1 ? 'argument' : 'counter'
                };

                roundMessages.push(msg);
                history.push(msg);
                onMessage(msg); // Emit sequentially for UI

                // ── Publish to event bus if bus-driven mode is active ────────
                if (this.eventBus) {
                    const proposalEvent: AgentProposalEvent = {
                        type: 'agent:proposal',
                        agentId: agent.id,
                        round,
                        topic,
                        content: response.trim(),
                        timestamp: Date.now(),
                    };
                    this.eventBus.publish(proposalEvent);
                }
            }

            // ── Dynamic Early Termination Check ─────────────────────────────
            if (round >= 2 && round < numRounds) {
                if (this.arbitrator) {
                    await this.arbitrator.awaitPendingTasks();
                }
                // Bus mode: check arbitrator consensus
                if (this.arbitrator?.hasConsensus()) {
                    this.logger.info('  [ArbitratorAgent] Consensus detected — early termination.');
                    break;
                }
                // Fallback mode: LLM-based check
                if (!this.eventBus) {
                    const checkPrompt = `Based on the following messages from Round ${round}, have the agents reached a clear consensus on the topic? Answer ONLY "YES" or "NO".\n\n${roundMessages.map(m => `[${m.agentId}]: ${m.content}`).join('\n')}`;
                    const checkResponse = await this.llmService.generateText(checkPrompt);
                    if (checkResponse.trim().toUpperCase().includes('YES')) {
                        this.logger.info('  Dynamic Early Termination: Consensus reached.');
                        break;
                    }
                }
            }
        }

        // ── Phase B: Convergence / PM consensus ───────────────────────────
        if (cancellationToken?.isCancellationRequested) { throw new Error('Cancelled by user'); }
        this.logger.info('  Convergence phase');

        let convergenceResponse: string;

        // Bus-driven mode: delegate synthesis to ArbitratorAgent
        if (this.arbitrator) {
            const result = await this.arbitrator.synthesize(topic);
            convergenceResponse = result.summary;
            this.arbitrator.stop();
        } else {
            // Legacy mode: PM-convergence prompt
            const transcript = history.map(m => `[${m.agentId.toUpperCase()}] (Round ${m.round}): ${m.content}`).join('\n\n');
            const convergencePrompt = `You are the Product Manager who has chaired the debate.
The debate among the 8 BMAD agents (including the Security Engineer) has concluded.
Original Topic: ${topic}

Full Debate Transcript:
${transcript}

Synthesize the debate into a single executive consensus. Resolve disagreements authoritatively.
Include any security concerns and compliance requirements raised by the Security Engineer.
Keep it concise but authoritative (max 250 words).`;
            convergenceResponse = await this.llmService.generateText(convergencePrompt);
        }

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

        const lastByAgent = new Map<string, string>();
        for (const m of history) {
            lastByAgent.set(m.agentId, m.content);
        }
        const condensed = Array.from(lastByAgent.entries())
            .map(([id, content]) => `[${id.toUpperCase()}]: ${content}`)
            .join('\n');

        const prdPrompt = `You are a Technical Product Manager. Your task is to generate a comprehensive, professional, production-ready Product Requirements Document (PRD) as a JSON array.

Original Topic: "${topic}"

Agent consensus and inputs:
${condensed}

CRITICAL CONSENSUS RULE:
The PRD sections MUST be directly synthesized from the Agent Consensus and debate history provided above. Do NOT use generic placeholder templates. Every technical stack decision, pricing tier, feature list, and threat mitigation MUST match what the agents debated and agreed upon, and what the PM synthesized in the consensus. Do not invent details that contradict the debate.

Respond ONLY with a valid JSON array. Do not include markdown code fences, do not include any commentary before or after.
Each element in the array must strictly match this structure:
{
  "title": "Section Title",
  "content": "Full section content in markdown format"
}

You MUST include the following 19 sections in this exact order:

1. "EXECUTIVE SUMMARY" — Product vision (1 paragraph), problem being solved, proposed solution, target market/TAM estimate, conversion modeling variables/calculator references, and 3-5 KPIs.
2. "PROBLEM STATEMENT" — Current pain points with evidence/data, who is affected and how severely, cost of the problem (time, money, risk), and why existing solutions fail.
3. "USER PERSONAS" — Define minimum 3 distinct, specific personas (Name, role, company size, goals, motivations, pain points, technical proficiency, budget authority) and key user stories in "As a [persona], I want to... so that..." format.
4. "GOALS, NON-GOALS & CONSTRAINTS" — Explicit goals with measurable outcomes, explicit non-goals (what this product will NOT do and why), technical, business, and regulatory constraints. Include MoSCoW prioritization methodology mapping for the initial release.
5. "BUSINESS STRATEGY" — Pricing model table with all tier definitions and limits (e.g. Free, Pro $99, Enterprise $499/custom), free tier rate limits and abuse/DDoS prevention strategy, competitive landscape (name at least 5 competitors like Snyk, Detectify, Burp Suite, Qualys, Rapid7, ZAP), differentiation and moat, GTM plan (Alpha, Beta, GA with dates), revenue model and path to $1M ARR.
6. "TECHNICAL ARCHITECTURE" — System architecture diagram description (frontend, API gateway, services, workers, DB, cache, storage). Tech stack with version numbers and justifications. Infrastructure spec (cloud provider, regions, containerization, orchestration, environment strategy dev/staging/prod). Scalability plan (horizontal scaling, load balancing, auto-scaling triggers, read-replicas, and row-level locking for inventory management). Dependency map table (third-party services/libraries with license types and risk flags). Monitoring and observability (logging, APM, alerting). Backup and disaster recovery plan (RPO and RTO targets). CRITICAL: Vite is strictly a frontend build tool/bundler; the API Gateway and backend/worker microservices MUST NOT be built using or described as running on Vite. Specify actual backend technologies (e.g., Kong, Supabase Edge Functions, Node.js).
7. "API SPECIFICATION" — Full endpoint list table (method, path, auth required, rate limit). Request and response payload schemas for every endpoint. Auth flow detail (OAuth2 scopes, JWT expiry, refresh strategy, SSO/SAML for enterprise). Error codes and response format for all failure states. Webhook spec if applicable. Rate limiting rules per tier. Versioning strategy.
8. "DATA MODEL" — All database tables/collections with field names, types, constraints, and indexes. Entity relationship description and data flow diagram description.
9. "CORE FEATURES & FUNCTIONAL REQUIREMENTS" — For each core feature: name, description, functional requirements (numbered, testable using 'SHALL', 'SHOULD', 'MAY'), acceptance criteria (Given/When/Then format), edge cases & error states, and dependencies on other features. Include a granular Agile backlog breakdown example with Epics, Stories (As a / I want to / So that), Acceptance Criteria (Given-When-Then), and Technical Task Decomposition (Backend/Frontend).
10. "UX & DESIGN REQUIREMENTS" — Key screen list with layout description, user flow for each core journey, accessibility standard (WCAG 2.1 AA minimum), localization requirements (languages, RTL support), design system/component library to be used, and responsive breakpoints.
11. "DATA HANDLING & PRIVACY" — Data classification schema table (public, internal, confidential, restricted), encryption spec (AES-256 rest, TLS 1.3 minimum in-transit), data retention policy per type, GDPR implementation checklist (consent, erasure, portability, DPA, DPIA), other applicable compliance (HIPAA scope justification vs dropping PHI, SOC2, PCI-DSS Level 1 compliance structures where no raw credit card details reside in internal databases), and data residency requirements.
12. "SECURITY & THREAT MODEL" — STRIDE threat enumeration for each major component, attack surface map, specific mitigations for each threat, auth and authorization model (RBAC definitions), secret management strategy, penetration testing plan, and vulnerability disclosure policy.
13. "BILLING & SUBSCRIPTION MANAGEMENT" — Subscription lifecycle (create, upgrade, downgrade, cancel), payment provider (e.g. Stripe) and integration spec, proration logic, failed payment handling, invoice and receipt spec.
14. "SUCCESS METRICS & ACCEPTANCE CRITERIA" — KPIs with baseline, target (must have numbers), and measurement method. Definition of done for the MVP. Acceptance criteria per feature (measurable, not vague). Latency targets (separate UI/API response target < 200ms p95 from background task duration). Error rate thresholds. Load testing requirements (concurrent users, throughput). Specify caching invalidation thresholds (e.g. Redis catalog lists auto-invalidating in 300s or on admin override).
15. "ROADMAP & RELEASE PLAN" — 3 phases (MVP, Phase 2, Phase 3) formatted as a Markdown table with timeline start and end dates. Each phase MUST enumerate a concrete list of scope/features to be built with a 2-3 sentence description, team ownership per feature, dependencies, blockers, and phase launch criteria. For the MVP, provide a granular sprint-level breakdown (Sprints 1-4) detailing Core Infrastructure/Auth, Catalog/Search, Cart/Checkout/Payment, and Fulfillment/Notifications.
16. "SLA, SUPPORT & OPERATIONS" — Uptime target (e.g. 99.9%) with measurement method, incident severity definitions (P0–P3), incident response and escalation procedure, support channels per tier, SLA response and resolution times table per tier and severity, on-call rotation plan, and runbook reference list.
17. "TEST PLAN & QA STRATEGY" — Test types required (unit, integration, E2E, load, security), coverage targets per type, test environment strategy, regression testing approach, and performance benchmarks to pass before release.
18. "RISKS & MITIGATIONS" — Risk register table: for each risk include probability (H/M/L), impact (H/M/L), owner, mitigation, and contingency. Must cover technical, business, compliance, security, and reputational risks.
19. "OPEN QUESTIONS & DECISIONS LOG" — Unresolved decisions with owner and due date, all assumptions made (explicitly flagged), and decisions already made with rationale.

QUALITY RULES:
- Use tables wherever lists of items have multiple attributes.
- Use Given/When/Then for all acceptance criteria.
- Every KPI must have a number, not just a direction.
- No vague language: replace "fast", "secure", "scalable" with specific measurable targets.
- Flag any section where an assumption was made.
- Total length should be comprehensive enough that an engineering team can build without asking clarifying questions.
- Never mix frontend build systems (Vite) with backend gateways or runtimes in architectural specifications.
- Enforce TLS 1.3 minimum for all in-transit communications.`;

        let prdJson = await this.llmService.generateText(prdPrompt);

        // Robust JSON extraction: look for the start of the array
        const jsonMatchPrd = prdJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatchPrd) {
            prdJson = jsonMatchPrd[0];
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

    private buildAgentRoundPrompt(
        topic: string,
        agentId: string,
        agentRole: string,
        round: number,
        history: DebateMessage[]
    ): string {
        const historyText = history.length > 0
            ? history.map(m => `[${m.agentId.toUpperCase()}] (Round ${m.round}): ${m.content}`).join('\n\n')
            : 'No debate history yet.';

        const instruction = round === 1
            ? "Provide your initial perspective on the topic, identifying key priorities and potential challenges from your domain."
            : "Respond to your colleagues' previous points. Defend your domain's needs, suggest compromises, or highlight issues in proposals.";

        const securitySpecific = agentId === 'security'
            ? `\nAs Security Engineer, ALWAYS address:
1. What attack vectors exist in the proposed feature? (reference OWASP Top 10 categories)
2. Does this feature collect or process PII or health data? (justifying HIPAA scope or explicitly dropping it if not applicable; flagging for GDPR)
3. What authentication and authorization model is required?
4. Are there any insecure defaults, hardcoded secrets, or misconfiguration risks?
5. What threat model applies? (including TLS 1.3 minimum for all transit and abuse/DDoS mitigations)
6. If scanning/accessing external or unowned websites is required, design a concrete domain ownership verification workflow (e.g. DNS TXT token records, meta tags, or file upload verification) to prevent abuse and legal risks.`
            : '';

        return `You are participating in a team debate on:
Topic: "${topic}"

Your Role: ${agentRole}
This is Round ${round}.

Here is the debate transcript so far:
${historyText}

Instruction:
${instruction}${securitySpecific}

Provide a concise, direct response representing your persona. Keep it under 150 words. Do NOT include any JSON formatting or metadata, respond with raw text/markdown.`;
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
            md += `### ${section.title}\n\n${section.content}\n\n`;

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
