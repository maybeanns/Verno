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
    modelId?: string
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
                max_tokens: 2048,
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
            url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            model = modelId || 'gemini-1.5-pro';
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

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2048,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${provider} API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}


// ─── Prompt builders (identical to extension's DebateOrchestrator) ───────────

function buildAgentPrompt(
    topic: string,
    agentId: string,
    role: string,
    history: DebateMessage[],
    round: number
): string {
    const historyText =
        history.length === 0
            ? 'No prior messages.'
            : history.map((m) => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n');

    const baseInstruction =
        round === 1
            ? 'State your initial perspective, identifying key priorities and potential challenges from your domain.'
            : "Respond to your colleagues' points. Defend your domain's needs, suggest compromises, or highlight issues in their proposals.";

    const securityAddendum =
        agentId === 'security'
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

function buildConvergencePrompt(topic: string, history: DebateMessage[]): string {
    return `You are the Product Manager who has chaired the debate.
The 3-round debate among the 8 BMAD agents (including the Security Engineer) has concluded.
Original Topic: ${topic}

Full Debate Transcript:
${history.map((m) => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n')}

Synthesize the debate into a single executive consensus. Resolve disagreements authoritatively.
Include any security concerns and compliance requirements raised by the Security Engineer.
Keep it concise but authoritative (max 250 words).`;
}

function buildPRDPrompt(topic: string, history: DebateMessage[]): string {
    return `You are a Technical Product Manager. Based on the following debate and executive summary, generate a formal Product Requirements Document (PRD).

Original Topic: ${topic}

Debate History & Consensus:
${history.map((m) => `[${m.agentId.toUpperCase()}]: ${m.content}`).join('\n\n')}

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

function applySecurityPass(sections: PRDSection[]): PRDSection[] {
    return sections.map((section) => {
        const lower = (section.content || '').toLowerCase();
        const flags: string[] = [];

        for (const kw of GDPR_KEYWORDS) {
            if (lower.includes(kw)) {
                flags.push(`⚠️ GDPR: "${kw}" detected — Add explicit consent mechanism, data retention policy (Art. 5), and right-to-erasure endpoint (Art. 17)`);
                break; // one GDPR flag per section is enough
            }
        }
        for (const kw of HIPAA_KEYWORDS) {
            if (lower.includes(kw)) {
                flags.push(`⚠️ HIPAA: "${kw}" detected — Encrypt PHI at rest (AES-256) and in transit (TLS 1.3); enable audit logging; BAA required`);
                break;
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
                const numRounds = 3;

                // ── Phase A: 3-round multi-agent debate ───────────────────
                send('phase', { phase: 'debate', message: 'Starting 8-agent debate...' });

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
                const convergenceResponse = await callLLM(convergencePrompt, provider, apiKey, model);

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
                let prdJson = await callLLM(prdPrompt, provider, apiKey, model);

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

                // ── Final result ──────────────────────────────────────────
                const prdTitle = topic.substring(0, 80);
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
