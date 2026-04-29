/**
 * POST /api/debate — 8-agent multi-round PRD debate engine (SSE stream).
 *
 * This mirrors the extension's DebateOrchestrator exactly:
 *   Phase A: 3-round debate among 8 agents
 *   Phase B: PM convergence / consensus
 *   Phase C: PRD generation (structured JSON)
 *   Phase D: Security & Compliance pass
 *
 * Agents:
 *  1. analyst      — Business requirements, KPIs, user value
 *  2. architect    — Backend scalability, data models, API design
 *  3. ux           — User flows, interfaces, accessibility
 *  4. developer    — Code structure, technical feasibility, components
 *  5. pm           — Scope, milestones, prioritization
 *  6. qa           — Edge cases, testability, test plans
 *  7. techwriter   — Documentation, readability, API references
 *  8. security     — OWASP Top 10, GDPR/HIPAA, threat modeling
 */

import { NextRequest } from 'next/server';

// ─── Agent definitions (identical to extension) ─────────────────────────────

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
        role: 'Security Engineer (Focus on OWASP Top 10 attack vectors, authentication and authorization design, data classification (PII/PHI), GDPR/HIPAA compliance requirements, secret management, and threat modeling for all proposed features)',
    },
] as const;

// Agent display colors for the frontend
const AGENT_COLORS: Record<string, string> = {
    analyst: '#6366F1',
    architect: '#10B981',
    ux: '#F59E0B',
    developer: '#3B82F6',
    pm: '#EC4899',
    qa: '#EF4444',
    techwriter: '#8B5CF6',
    security: '#F97316',
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
    analyst: 'Business Analyst',
    architect: 'System Architect',
    ux: 'UX Designer',
    developer: 'Developer',
    pm: 'Product Manager',
    qa: 'QA Engineer',
    techwriter: 'Technical Writer',
    security: 'Security Engineer',
};

// ─── Debate message type ────────────────────────────────────────────────────

interface DebateMessage {
    agentId: string;
    content: string;
    round: number;
    timestamp: number;
    type: 'argument' | 'counter' | 'consensus';
}

// ─── PRD types (identical to extension) ─────────────────────────────────────

interface PRDSection {
    title: string;
    content: string;
    complianceFlags?: string[];
}

// ─── LLM Call abstraction ───────────────────────────────────────────────────

async function callLLM(
    prompt: string,
    provider: string,
    apiKey: string,
    modelId?: string,
    maxTokens: number = 800
): Promise<string> {
    if (provider === 'Anthropic' || provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Anthropic API error (${res.status}): ${errBody}`);
        }
        const data = await res.json();
        return data.content?.[0]?.text?.trim() ?? '';
    }

    let url = '';
    let model = '';

    switch (provider) {
        case 'test':
            url = 'https://api.groq.com/openai/v1/chat/completions';
            apiKey = process.env.GROQ_API_KEY || apiKey;
            model = modelId !== 'test' && modelId ? modelId : 'llama-3.3-70b-versatile';
            break;
        case 'Groq':
        case 'groq':
        case 'Meta': // Kept for backwards compatibility
            url = 'https://api.groq.com/openai/v1/chat/completions';
            model = modelId || 'llama-3.3-70b-versatile';
            break;
        case 'OpenAI':
        case 'openai':
            url = 'https://api.openai.com/v1/chat/completions';
            model = modelId || 'gpt-4o';
            break;
        case 'Qwen':
            url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            model = modelId || 'qwen-max';
            break;
        case 'Mistral AI':
            url = 'https://api.mistral.ai/v1/chat/completions';
            model = modelId || 'mistral-large-latest';
            break;
        case 'Google':
        case 'google':
            url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            model = modelId || 'gemini-2.5-flash';
            break;
        case 'Moonshot AI':
            url = 'https://api.moonshot.cn/v1/chat/completions';
            model = modelId || 'moonshot-v1-32k';
            break;
        case 'MiniMax':
            url = 'https://api.minimax.chat/v1/chat/completions';
            model = modelId || 'minimax-text-01';
            break;
        case 'DeepSeek':
            url = 'https://api.deepseek.com/chat/completions';
            model = modelId || 'deepseek-chat';
            break;
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }

    const makeRequest = async (currentModel: string) => {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: 0.7,
            }),
        });
    };

    let res = await makeRequest(model);

    // Fallback logic for Groq/Test
    if (!res.ok && res.status === 429 && (provider.toLowerCase() === 'groq' || provider === 'test')) {
        const fallbacks = [
            'llama-3.1-8b-instant',
            'llama-3.3-70b-versatile',
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'meta-llama/llama-prompt-guard-2-22m',
            'qwen/qwen3-32b',
            'Qwen/Qwen2.5-32B-Instruct'
        ];

        for (const fallbackModel of fallbacks) {
            if (fallbackModel === model) continue; // Skip if it was the primary model

            console.warn(`[callLLM] 429 on primary model. Falling back to ${fallbackModel}...`);
            res = await makeRequest(fallbackModel);

            if (res.ok || res.status !== 429) {
                break; // Stop falling back if we succeeded or got a non-rate-limit error
            }
        }
    }

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${provider} API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}


// ─── Prompt builders ────────────────────────────────────────────────────────

// Per-agent deep-dive instructions — tells each agent EXACTLY what specifics to provide
const AGENT_SPECIFICS: Record<string, { r1: string; r2: string }> = {
    analyst: {
        r1: 'Define 3 distinct, specific user personas (Name, Role, Context, Pain point). E.g., not "developers" but "Sarah, Freelance Dev: needs 1-page PDF for client handoff". Define a concrete pricing proposal (e.g., freemium with $29/mo tier vs per-scan). State competitive positioning: why pick this over Qualys/Rapid7/ZAP? What is the moat (speed, UX, price)?',
        r2: 'Refine personas to be highly specific based on feedback. Add measurable KPIs (e.g., churn, NPS, scan completion). Finalize the pricing strategy (do not defer this). Define what MVP success looks like.',
    },
    architect: {
        r1: 'Propose a concrete technical architecture. Describe the exact data flow (e.g., User → API Gateway → Auth → Queue → ZAP worker → DB → Report renderer). Specify scaling rules (how many instances?), expected scan times, and where the bottleneck is. Include an architecture diagram description.',
        r2: 'Respond to feasibility concerns. Address failure handling: What if a worker crashes mid-scan? Is the report partial or retried? State explicit performance specs: latency, queue sizes, timeouts.',
    },
    ux: {
        r1: 'Describe 2-3 key user flows. Define the Report Structure in detail: What metrics on the summary page? Severity tiers? Prioritization logic? Filtering/sorting capabilities? Describe the first-run onboarding experience (5-min tutorial, sample scan?).',
        r2: 'Refine report layout. How are remediation recommendations presented? Add UI acceptance criteria (load times, mobile). Define error states if a scan fails.',
    },
    developer: {
        r1: 'List the exact tech stack (languages, frameworks, libraries, databases). Define the project structure. What build tools, CI/CD pipeline, and deployment strategy? Estimate implementation complexity. Address scanning integration details and worker management.',
        r2: 'Respond to architecture proposals. Identify technical debt risks. Propose specific testing strategy. What needs to be built vs open-source?',
    },
    pm: {
        r1: 'Define a 3-phase roadmap. MVP (launch), Phase 2 (growth), Phase 3 (scale). List specific features per phase. Do not defer pricing; mandate a pricing decision for MVP. What are the GTM milestones?',
        r2: 'Resolve disagreements. Finalize MVP scope. Ensure report structure, pricing, and architecture diagrams are strictly included in the consensus. Define launch criteria.',
    },
    qa: {
        r1: 'Define specific test scenarios. What happens if a scan takes >5 minutes? (Async + email notifications vs real-time if <30s). Define false positive/negative thresholds. What monitoring and alerting is needed?',
        r2: 'Challenge vague acceptance criteria. Define the QA strategy (manual vs automated, load testing). Identify the top 5 things most likely to break.',
    },
    techwriter: {
        r1: 'Define documentation deliverables. Detail the onboarding strategy (welcome emails, help templates). What is the exact structure of a vulnerability recommendation (Severity + Business Risk + Fix Steps)?',
        r2: 'Refine the report and onboarding docs based on feedback. Ensure all technical terms have user-facing explanations.',
    },
    security: {
        r1: 'Define the threat model FOR THIS SERVICE: How do you prevent API abuse (scan bombing)? How do you handle stored XSS in report data? DMCA/scanning unowned sites (verification mechanisms)? Secure deletion of scan data? Auth model and data classification.',
        r2: 'Provide concrete GDPR implementation details (e.g., "Consent banner on signup, auto-delete scans after 90 days per Art. 17, DPA with AWS"). State explicitly if PHI is handled; if NO, state "No PHI handling".',
    },
};

function buildAgentPrompt(
    topic: string,
    agentId: string,
    role: string,
    history: DebateMessage[],
    round: number
): string {
    const recentHistory = history.slice(-6);
    const historyText =
        recentHistory.length === 0
            ? 'No prior messages.'
            : recentHistory.map((m) => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n');

    const specifics = AGENT_SPECIFICS[agentId];
    const instruction = round === 1
        ? (specifics?.r1 ?? 'State your key priorities and challenges from your domain.')
        : (specifics?.r2 ?? 'Respond to colleagues. Defend your priorities, suggest compromises, highlight issues.');

    return `You are the ${role} on a product team.
Topic: "${topic}"

Recent debate:
${historyText}

Round ${round} instructions:
${instruction}

RULES:
- Be SPECIFIC: name tools, frameworks, numbers, thresholds — not generic advice.
- Every claim needs a concrete example or metric.
- Max 150 words. No filler.`;
}

function buildConvergencePrompt(topic: string, history: DebateMessage[]): string {
    const lastByAgent = new Map<string, string>();
    for (const m of history) {
        lastByAgent.set(m.agentId, m.content);
    }
    const summaryText = Array.from(lastByAgent.entries())
        .map(([id, content]) => `[${id.toUpperCase()}]: ${content}`)
        .join('\n');

    return `You are the Lead Product Manager synthesizing a product debate on: "${topic}"

Final positions from each agent:
${summaryText}

Your task:
1. RESOLVE all disagreements with a clear decision and rationale.
2. IDENTIFY any gaps: missing user personas? No pricing model? No architecture specifics? Vague acceptance criteria? Flag them.
3. CONSOLIDATE into a unified product vision with: target users, core value prop, MVP scope, key technical decisions, and compliance requirements.
4. For EACH gap identified, provide a concrete recommendation (not just "needs more detail").

Be decisive. Use specific numbers, tools, and technologies. Max 250 words.`;
}

function buildPRDPrompt(topic: string, history: DebateMessage[]): string {
    const lastByAgent = new Map<string, string>();
    for (const m of history) {
        lastByAgent.set(m.agentId, m.content);
    }
    const condensed = Array.from(lastByAgent.entries())
        .map(([id, content]) => `[${id.toUpperCase()}]: ${content}`)
        .join('\n');

    return `Generate a professional Product Requirements Document as a JSON array. Topic: "${topic}"

Agent consensus and inputs:
${condensed}

Respond ONLY with a valid JSON array. No markdown fences, no commentary.
Each element: {"title":"Section Title","content":"Full section content in markdown"}

REQUIRED SECTIONS (in this order):

1. "Overview" — 2-3 sentence product summary. What it does, who it's for, why it matters.

2. "Problem Statement" — The specific pain point. Include market context and why existing solutions fail. Be concrete.

3. "User Personas & Stories" — Define 3 distinct, specific personas (Name, Role, Work Context, Specific Pain Point). Then 3-5 specific user stories.

4. "Goals, Non-Goals & Business Strategy" — Goals: 3-5 measurable objectives. Non-Goals: explicitly out of scope. Pricing Strategy: Mandatory concrete proposal (e.g., Freemium/Tiers/Costs). Competitive Positioning: Why choose this over alternatives (Qualys/Rapid7/ZAP)? What is the moat?

5. "Technical Architecture" — Include a detailed architecture diagram description (e.g., User → API Gateway → Worker → DB). Name specific technologies. Define scaling rules, expected scan times, bottleneck analysis, and failure handling (what happens if a worker crashes mid-scan).

6. "Core Engine & Capabilities" — What specific capabilities does the product have? What are the limitations? What tools/libraries power it? Performance specs: throughput, latency targets, timeout limits, concurrency.

7. "Report Structure & Output" — Describe the core deliverable. What metrics appear on the summary page? Severity tiers (Critical/High/Medium/Low)? Prioritization logic? Filtering/sorting capabilities? Export formats? Describe the visual layout.

8. "Data Handling & Privacy" — Data classification (PII, PHI, public). Encryption: at-rest and in-transit. Data retention policy. For GDPR: concrete implementations (e.g., "Consent banner on signup, auto-delete after 90 days per Art. 17"). For HIPAA: BAA, audit logging, or explicitly state "No PHI handled".

9. "Security & Threat Model" — Threat model FOR THIS SERVICE: API abuse prevention (scan bombing), handling stored XSS in report data, scanning unowned sites (DMCA verification), secure data deletion. Auth model and secret management.

10. "Success Metrics & Acceptance Criteria" — 5-7 measurable KPIs with targets (e.g., NPS >40, User retention M1 >40%). Acceptance criteria must be testable. Include onboarding strategy (e.g., first-run 5-min tutorial).

11. "Roadmap" — 3 phases: MVP, Phase 2, Phase 3. Each phase lists specific features. Include launch criteria for MVP.

12. "Risks & Mitigations" — 5-7 concrete risks with severity (High/Medium/Low), likelihood, impact, and specific mitigation strategy. Include technical risks, business risks, and compliance risks. No vague mitigations like "develop a plan" — state the actual plan.

QUALITY RULES:
- NO generic or vague statements. Every point must be specific and actionable.
- Use real tool/framework names, not "appropriate technology".
- Include numbers: percentages, time limits, user counts, cost estimates.
- User stories must be testable — an engineer should be able to write a test from each one.
- Compliance must include implementation details, not just "be compliant".
- Risks must have concrete mitigations, not "address later".`;
}

// ─── Security & Compliance pass (mirrors SecurityComplianceService) ──────────

const GDPR_KEYWORDS = [
    'email', 'name', 'address', 'phone', 'user data', 'personal', 'profile',
    'ip address', 'location', 'geolocation', 'analytics', 'tracking', 'cookie',
    'biometric', 'financial', 'credit', 'bank', 'identity', 'consent',
];

const HIPAA_KEYWORDS = [
    'health', 'medical', 'diagnosis', 'patient', 'prescription', 'clinical',
    'symptom', 'doctor', 'hospital', 'lab result', 'ehr', 'phi', 'treatment',
    'protected health', 'medication', 'dosage', 'allergy', 'immunization',
    'mental health', 'substance abuse', 'genomic',
];

// Context-specific compliance guidance instead of repeating the same boilerplate
const GDPR_ACTIONS: Record<string, string> = {
    'email': 'Implement double opt-in for email collection. Add unsubscribe endpoint. Store consent timestamp.',
    'name': 'Minimize data collection — collect only if essential. Add data export (Art. 20) and deletion (Art. 17) endpoints.',
    'address': 'Add explicit consent mechanism with purpose limitation. Implement data retention policy (Art. 5) with auto-purge.',
    'phone': 'Collect only with explicit consent. Provide opt-out mechanism. Do not use for secondary purposes without re-consent.',
    'user data': 'Implement privacy-by-design (Art. 25). Data Protection Impact Assessment (DPIA) required if processing at scale.',
    'personal': 'Map all personal data flows. Implement access controls. Designate a Data Protection Officer if required.',
    'profile': 'Allow users to view, export, and delete their profile data. Implement right to data portability (Art. 20).',
    'ip address': 'IP addresses are PII under GDPR. Anonymize in logs (truncate last octet). Define retention period.',
    'location': 'Location data requires explicit consent. Implement granularity controls. Allow users to disable tracking.',
    'analytics': 'Use privacy-respecting analytics (e.g., Plausible, Fathom) or implement cookie consent banner with opt-out.',
    'tracking': 'Implement cookie consent banner (ePrivacy Directive). Allow granular consent (necessary vs. analytics vs. marketing).',
    'cookie': 'Cookie banner required. Categorize cookies (essential/functional/analytics/marketing). Respect "Do Not Track".',
    'consent': 'Consent must be freely given, specific, informed, unambiguous (Art. 7). Record consent with timestamp and version.',
};

const HIPAA_ACTIONS: Record<string, string> = {
    'health': 'If handling PHI: encrypt AES-256 at rest, TLS 1.3 in transit. BAA with all subprocessors. Audit logging required.',
    'patient': 'Implement role-based access controls. Minimum necessary standard applies. Audit all PHI access.',
    'medical': 'Assess if data qualifies as PHI. If yes: BAA, encryption, access controls, 6-year retention minimum.',
    'diagnosis': 'PHI — requires full HIPAA safeguards. Implement de-identification (Safe Harbor or Expert Determination).',
};

function applySecurityPass(sections: PRDSection[]): PRDSection[] {
    return sections.map((section) => {
        const lower = (section.content || '').toLowerCase();
        const flags: string[] = [];
        let gdprFlagged = false;
        let hipaaFlagged = false;

        // Check for negations to prevent false positive flags
        const explicitlyNoPHI = lower.match(/\b(no|zero|without|not\shandling)\s+(phi|protected\shealth|health\sdata)\b/i) || lower.includes('phi: none') || lower.includes('phi is not');
        const explicitlyNoGDPR = lower.match(/\b(no|zero|without|not\shandling)\s+(pii|personal\sdata)\b/i) || lower.includes('pii: none');

        for (const kw of GDPR_KEYWORDS) {
            if (!explicitlyNoGDPR && lower.includes(kw) && !gdprFlagged) {
                const action = GDPR_ACTIONS[kw] || `Implement consent banners on signup. Auto-delete data after 90 days (per Art. 17). DPA with cloud providers required.`;
                flags.push(`⚠️ GDPR: "${kw}" detected in "${section.title}" — ${action}`);
                gdprFlagged = true;
            }
        }
        for (const kw of HIPAA_KEYWORDS) {
            if (!explicitlyNoPHI && lower.includes(kw) && !hipaaFlagged) {
                const action = HIPAA_ACTIONS[kw] || `Encrypt PHI at rest (AES-256) and in transit (TLS 1.3); enable audit logging; BAA required`;
                flags.push(`⚠️ HIPAA: "${kw}" detected in "${section.title}" — ${action}`);
                hipaaFlagged = true;
            }
        }

        return { ...section, complianceFlags: [...(section.complianceFlags ?? []), ...flags] };
    });
}

// ─── Format PRD as Markdown ─────────────────────────────────────────────────

function formatPRDMarkdown(title: string, sections: PRDSection[]): string {
    let md = `# PRD: ${title}\n\n`;
    md += `> **Status:** DRAFT — Generated by Verno Multi-Agent Debate Engine\n\n`;
    md += `---\n\n`;

    for (const section of sections) {
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

    return md;
}

// ─── Generate clean PRD title ───────────────────────────────────────────────

function generateCleanTitle(rawTopic: string, sections: PRDSection[]): string {
    // Try to extract a title from the Overview section if it has a clear product name
    const overviewSection = sections.find(s => s.title === 'Overview');
    
    // Clean up the raw topic first
    let cleaned = rawTopic
        .replace(/[-–—>→]+/g, ' ')           // Remove arrows and dashes
        .replace(/\.\.\./g, ' ')               // Remove ellipsis
        .replace(/\b(it|i want|create|build|make|develop|design|write|generate|a|an|the|for|to|from|with|and|or|that|which|this|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could)\b/gi, ' ')  // Strip filler words
        .replace(/\s+/g, ' ')                  // Collapse whitespace
        .trim();
    
    // If it's too long, take the first meaningful phrase
    if (cleaned.length > 60) {
        // Take up to the first comma, period, or 60 chars
        const cutoff = cleaned.search(/[,.\n]/);
        if (cutoff > 10 && cutoff < 60) {
            cleaned = cleaned.substring(0, cutoff).trim();
        } else {
            // Take first 60 chars, break at last word boundary
            cleaned = cleaned.substring(0, 60).replace(/\s+\S*$/, '').trim();
        }
    }
    
    // Title-case it
    cleaned = cleaned
        .split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    
    // If we ended up with something too short or empty, use the overview
    if (cleaned.length < 5) {
        if (overviewSection && overviewSection.content) {
            // Extract first sentence from overview
            const firstSentence = overviewSection.content.split(/[.!?]/)[0].trim();
            if (firstSentence.length > 5 && firstSentence.length < 80) {
                cleaned = firstSentence;
            } else {
                cleaned = 'Product Requirements Document';
            }
        } else {
            cleaned = 'Product Requirements Document';
        }
    }
    
    return cleaned;
}

// ─── SSE helper ─────────────────────────────────────────────────────────────

function sseEncode(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    let body: any = {};
    try {
        body = await request.json();
    } catch (e) {
        // Body is empty or malformed
    }
    const { topic, provider, apiKey, projectType, model } = body as {
        topic: string;
        provider: string;
        apiKey: string;
        projectType?: string;
        model?: string;
    };

    if (!topic || !provider || !apiKey) {
        return new Response(JSON.stringify({ error: 'Missing required fields: topic, provider, apiKey' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseEncode(event, data)));
            };

            try {
                const history: DebateMessage[] = [];
                const numRounds = 2;

                // ── Phase A: 3-round multi-agent debate ───────────────────
                send('phase', { phase: 'debate', message: 'Starting optimized 8-agent debate (2 rounds)...' });

                for (let round = 1; round <= numRounds; round++) {
                    send('round', { round, total: numRounds });

                    for (const agent of DEBATE_AGENTS) {
                        send('agent-thinking', {
                            agentId: agent.id,
                            agentName: AGENT_DISPLAY_NAMES[agent.id],
                            round,
                        });

                        const prompt = buildAgentPrompt(topic, agent.id, agent.role, history, round);
                        const response = await callLLM(prompt, provider, apiKey, model);

                        const msg: DebateMessage = {
                            agentId: agent.id,
                            content: response,
                            round,
                            timestamp: Date.now(),
                            type: round === 1 ? 'argument' : 'counter',
                        };
                        history.push(msg);

                        send('agent-response', {
                            agentId: agent.id,
                            agentName: AGENT_DISPLAY_NAMES[agent.id],
                            agentColor: AGENT_COLORS[agent.id],
                            content: response,
                            round,
                            type: msg.type,
                        });
                    }
                }

                // ── Phase B: Convergence / PM consensus ───────────────────
                send('phase', { phase: 'consensus', message: 'Reaching consensus...' });

                const convergencePrompt = buildConvergencePrompt(topic, history);
                const convergenceResponse = await callLLM(convergencePrompt, provider, apiKey, model, 600);

                const convergenceMsg: DebateMessage = {
                    agentId: 'pm',
                    content: convergenceResponse,
                    round: numRounds + 1,
                    timestamp: Date.now(),
                    type: 'consensus',
                };
                history.push(convergenceMsg);

                send('consensus', {
                    agentId: 'pm',
                    agentName: 'Product Manager',
                    agentColor: AGENT_COLORS['pm'],
                    content: convergenceResponse,
                    round: numRounds + 1,
                    type: 'consensus',
                });

                // ── Phase C: PRD generation ───────────────────────────────
                send('phase', { phase: 'prd-gen', message: 'Generating PRD document...' });

                const prdPrompt = buildPRDPrompt(topic, history);
                let prdJson = await callLLM(prdPrompt, provider, apiKey, model, 3500);

                // Robust JSON extraction
                const jsonMatch = prdJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
                if (jsonMatch) {
                    prdJson = jsonMatch[0];
                } else {
                    prdJson = prdJson.replace(/```json/gi, '').replace(/```/g, '').trim();
                }

                let sections: PRDSection[] = [];
                try {
                    sections = JSON.parse(prdJson);
                } catch {
                    // Fallback to convergence text
                    sections = [{
                        title: 'Overview and Synthesis',
                        content: convergenceResponse,
                        complianceFlags: [],
                    }];
                }

                // ── Phase D: Security & Compliance pass ───────────────────
                send('phase', { phase: 'security-pass', message: 'Running security & compliance checks...' });
                sections = applySecurityPass(sections);

                // ── Generate clean title ──────────────────────────────────
                const prdTitle = generateCleanTitle(topic, sections);
                const prdMarkdown = formatPRDMarkdown(prdTitle, sections);

                send('phase', { phase: 'complete', message: 'PRD generation complete!' });
                send('prd-complete', {
                    title: prdTitle,
                    markdown: prdMarkdown,
                    sections,
                    debateHistory: history,
                    agentCount: DEBATE_AGENTS.length,
                    roundCount: numRounds,
                });

                send('done', { success: true });
            } catch (err: any) {
                send('error', { message: err.message || 'Unknown error during debate' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
