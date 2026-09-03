/**
 * POST /api/debate — 8-agent multi-round PRD debate engine (SSE stream).
 *
 * This mirrors the extension's DebateOrchestrator exactly:
 *   Phase A: 2-round debate among 8 agents
 *   Phase B: PM convergence / consensus
 *   Phase C: PRD generation (structured JSON, generated in batches)
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
import { DEFAULT_GROQ_MODEL } from '@verno/llm';
import { PERSONAS, personaRole } from '@verno/agents';
import { guardSharedKeyUsage } from '@/lib/api-guard';

import {
    extractSections,
    titleKey,
    type PRDSection,
} from '@/lib/prd/sections';
import {
    MAX_DEBATE_ROUNDS,
    ROUND_SKIP_THRESHOLD,
    roundReachedThreshold,
    scoreRound,
    topicComplexity,
} from '@/lib/prd/debate-signal';

// ─── Document section catalog ───────────────────────────────────────────────
// Single source of truth for both the Fast Track and the full-debate path, so
// the two can no longer drift apart.

interface SectionSpec {
    title: string;
    brief: string;
}

// The stack is a real engineering decision, so it follows the project type
// rather than forcing a single web stack onto every kind of product.
const STACK_BY_PROJECT_TYPE: Record<string, string> = {
    'Full Stack App': `- React 18+ with TypeScript (Vite is strictly the frontend build tool/bundler)
- Tailwind CSS for styling
- shadcn/ui for UI components
- Supabase for backend (auth, database, storage) or a custom Node.js/Express backend where appropriate`,
    'Dashboard': `- React 18+ with TypeScript (Vite is strictly the frontend build tool/bundler)
- Tailwind CSS for styling
- shadcn/ui for UI components, with Recharts or visx for data visualisation
- Supabase for backend (auth, database, storage) or a custom Node.js/Express backend where appropriate`,
    'Mobile App': `- React Native 0.74+ with TypeScript, built and delivered with Expo (SDK 51+)
- NativeWind (Tailwind for React Native) for styling
- React Navigation for routing, with over-the-air updates via EAS Update
- Supabase for backend (auth, database, storage) or a custom Node.js/Express backend where appropriate`,
    'Landing Page': `- React 18+ with TypeScript, statically built with Astro or a Next.js static export for first-load performance and SEO
- Tailwind CSS for styling
- shadcn/ui for UI components
- No application backend by default: forms post to a single serverless function or a hosted form service`,
    'Portfolio': `- React 18+ with TypeScript, statically built with Astro or a Next.js static export for first-load performance and SEO
- Tailwind CSS for styling
- shadcn/ui for UI components
- Content from local MDX or a headless CMS. No application backend, user accounts, or billing by default`,
};

function stackFor(projectType: string): string {
    const stack = STACK_BY_PROJECT_TYPE[projectType] ?? STACK_BY_PROJECT_TYPE['Full Stack App'];
    return `ENFORCED STACK (for a ${projectType}):\n${stack}`;
}

const PRD_SECTIONS: SectionSpec[] = [
    {
        title: 'EXECUTIVE SUMMARY',
        brief: 'Product vision (1 paragraph), problem being solved, proposed solution, target market/TAM estimate, and 3-5 KPIs.',
    },
    {
        title: 'PROBLEM STATEMENT',
        brief: 'Current pain points with evidence/data, who is affected and how severely, cost of the problem (time, money, risk), and why existing solutions fail.',
    },
    {
        title: 'USER PERSONAS',
        brief: 'Define minimum 3 distinct, specific personas (Name, role, company size, goals, motivations, pain points, technical proficiency, budget authority) and key user stories in "As a [persona], I want to... so that..." format.',
    },
    {
        title: 'GOALS, NON-GOALS & CONSTRAINTS',
        brief: 'Explicit goals with measurable outcomes, explicit non-goals (what this product will NOT do and why), technical, business, and regulatory constraints.',
    },
    {
        title: 'BUSINESS STRATEGY',
        brief: "Pricing model table with all tier definitions and limits, priced appropriately for this product's actual market. Free tier rate limits and abuse prevention strategy tied to this product's real cost drivers. Competitive landscape naming at least 5 real products that genuinely compete in THIS product's category — do not name tools from unrelated markets. Differentiation and moat, GTM plan (Alpha, Beta, GA with dates), revenue model and path to $1M ARR.",
    },
    {
        title: 'TECHNICAL ARCHITECTURE',
        brief: 'System architecture diagram description (frontend, API gateway, services, workers, DB, cache, storage). Tech stack with version numbers and justifications. Infrastructure spec (cloud provider, regions, containerization, orchestration, environment strategy dev/staging/prod). Scalability plan (horizontal scaling, load balancing, auto-scaling triggers). Dependency map table (third-party services/libraries with license types and risk flags). Monitoring and observability (logging, APM, alerting). Backup and disaster recovery plan (RPO and RTO targets). CRITICAL: the frontend build tool named in the stack (Vite, Expo, Astro) bundles the client only; the API Gateway and backend/worker microservices MUST NOT be described as running on it. Specify actual backend technologies (e.g., Kong, Supabase Edge Functions, Node.js).',
    },
    {
        title: 'API SPECIFICATION',
        brief: 'Full endpoint list table (method, path, auth required, rate limit). Request and response payload schemas for every endpoint. Auth flow detail (OAuth2 scopes, JWT expiry, refresh strategy, SSO/SAML for enterprise). Error codes and response format for all failure states. Webhook spec if applicable. Rate limiting rules per tier. Versioning strategy.',
    },
    {
        title: 'DATA MODEL',
        brief: 'All database tables/collections with field names, types, constraints, and indexes. Entity relationship description and data flow diagram description.',
    },
    {
        title: 'CORE FEATURES & FUNCTIONAL REQUIREMENTS',
        brief: "For each core feature: name, description, functional requirements (numbered, testable using 'SHALL', 'SHOULD', 'MAY'), acceptance criteria (Given/When/Then format), edge cases & error states, and dependencies on other features.",
    },
    {
        title: 'UX & DESIGN REQUIREMENTS',
        brief: 'Key screen list with layout description, user flow for each core journey, accessibility standard (WCAG 2.1 AA minimum), localization requirements (languages, RTL support), design system/component library to be used, and responsive breakpoints.',
    },
    {
        title: 'DATA HANDLING & PRIVACY',
        brief: 'Data classification schema table (public, internal, confidential, restricted), encryption spec (AES-256 rest, TLS 1.3 minimum in-transit), data retention policy per type, GDPR implementation checklist (consent, erasure, portability, DPA, DPIA), other applicable compliance (justify HIPAA scope explicitly — if no PHI is handled, state so plainly rather than adding compliance bloat; SOC2, PCI-DSS where relevant), and data residency requirements.',
    },
    {
        title: 'SECURITY & THREAT MODEL',
        brief: 'STRIDE threat enumeration for each major component, attack surface map, specific mitigations for each threat, auth and authorization model (RBAC definitions), secret management strategy, penetration testing plan, and vulnerability disclosure policy.',
    },
    {
        title: 'BILLING & SUBSCRIPTION MANAGEMENT',
        brief: 'Subscription lifecycle (create, upgrade, downgrade, cancel), payment provider (e.g. Stripe) and integration spec, proration logic, failed payment handling, invoice and receipt spec.',
    },
    {
        title: 'SUCCESS METRICS & ACCEPTANCE CRITERIA',
        brief: 'KPIs with baseline, target (must have numbers), and measurement method. Definition of done for the MVP. Acceptance criteria per feature (measurable, not vague). Latency targets (separate interactive UI/API response target < 200ms p95 from any background task duration). Error rate thresholds. Load testing requirements (concurrent users, throughput).',
    },
    {
        title: 'ROADMAP & RELEASE PLAN',
        brief: '3 phases (MVP, Phase 2, Phase 3) formatted as a Markdown table with timeline start and end dates. Each phase MUST enumerate a concrete list of scope/features to be built with a 2-3 sentence description, team ownership per feature, dependencies, blockers, and phase launch criteria.',
    },
    {
        title: 'SLA, SUPPORT & OPERATIONS',
        brief: 'Uptime target (e.g. 99.9%) with measurement method, incident severity definitions (P0-P3), incident response and escalation procedure, support channels per tier, SLA response and resolution times table per tier and severity, on-call rotation plan, and runbook reference list.',
    },
    {
        title: 'TEST PLAN & QA STRATEGY',
        brief: 'Test types required (unit, integration, E2E, load, security), coverage targets per type, test environment strategy, regression testing approach, and performance benchmarks to pass before release.',
    },
    {
        title: 'RISKS & MITIGATIONS',
        brief: 'Risk register table: for each risk include probability (H/M/L), impact (H/M/L), owner, mitigation, and contingency. Must cover technical, business, compliance, security, and reputational risks.',
    },
    {
        title: 'OPEN QUESTIONS & DECISIONS LOG',
        brief: 'Unresolved decisions with owner and due date, all assumptions made (explicitly flagged), and decisions already made with rationale.',
    },
];

const PLAN_SECTIONS: SectionSpec[] = [
    {
        title: 'EXECUTIVE SYSTEM DESIGN',
        brief: 'System overview, high-level architectural style (monolith, microservices, serverless), detailed tech stack choices with versions and justifications, and core design constraints.',
    },
    {
        title: 'INFRASTRUCTURE & ENVIRONMENT SPEC',
        brief: 'Hosting infrastructure specs (cloud provider, regions, edge networks), containerization (Docker, Docker Compose), CI/CD deployment pipeline steps, and environment strategy (dev, staging, production).',
    },
    {
        title: 'DATA MODEL & SCHEMA DESIGN',
        brief: 'Databases (relational/NoSQL), comprehensive SQL schemas or collection definitions (tables, field names, types, primary/foreign keys, constraints, and indexes), and entity relationship description.',
    },
    {
        title: 'API ARCHITECTURE & SPEC',
        brief: 'Full REST/GraphQL/tRPC endpoint catalog table (Method, Path, Auth Required, Description). Detailed request and response payload JSON schemas for core operations, authentication flow (JWT, OAuth2, session storage), and rate limiting policies.',
    },
    {
        title: 'FRONTEND COMPONENT TREE',
        brief: 'Folder structure, design system components (shadcn/ui), routing layout, responsive design strategy, and state management (Zustand, Redux, Context).',
    },
    {
        title: 'AGILE SPRINT ROADMAP',
        brief: 'Epic/story breakdown, story point estimation criteria, sprint decomposition (minimum 3 sprints with scope and launch criteria), and task assignments specifically distributed among the 8 BMAD agents (Mary/Analyst, Winston/Architect, Sally/UX, Amelia/Developer, PM, QA, Techwriter, Security).',
    },
];

// F4: a portfolio site has no pricing tiers, subscription lifecycle, or
// per-severity support SLA. Padding every project with the full enterprise
// section set is what makes generated PRDs read as boilerplate.
const SECTIONS_OMITTED_BY_PROJECT_TYPE: Record<string, string[]> = {
    'Landing Page': [
        'API SPECIFICATION',
        'DATA MODEL',
        'BILLING & SUBSCRIPTION MANAGEMENT',
        'SLA, SUPPORT & OPERATIONS',
    ],
    'Portfolio': [
        'BUSINESS STRATEGY',
        'API SPECIFICATION',
        'DATA MODEL',
        'BILLING & SUBSCRIPTION MANAGEMENT',
        'SLA, SUPPORT & OPERATIONS',
    ],
};

function sectionsFor(projectType: string, isPlanMode: boolean): SectionSpec[] {
    if (isPlanMode) {
        return PLAN_SECTIONS;
    }
    const omitted = SECTIONS_OMITTED_BY_PROJECT_TYPE[projectType];
    if (!omitted) {
        return PRD_SECTIONS;
    }
    const drop = new Set(omitted.map(titleKey));
    return PRD_SECTIONS.filter((spec) => !drop.has(titleKey(spec.title)));
}

const QUALITY_RULES = `QUALITY RULES:
- Ground every detail in the actual topic. Never carry over examples, competitor names, metrics, or threat scenarios from an unrelated product domain.
- Use tables wherever lists of items have multiple attributes.
- Use Given/When/Then for all acceptance criteria.
- Every KPI must have a number, not just a direction.
- No vague language: replace "fast", "secure", "scalable" with specific measurable targets.
- Flag any section where an assumption was made.
- Write each section in full depth — an engineering team must be able to build from it without asking clarifying questions.
- Never describe the frontend build tool as the runtime for a backend gateway or service.
- Enforce TLS 1.3 minimum for all in-transit communications.

EVIDENCE RULES (these override the instruction to be specific):
- NEVER invent a citation. Do not attribute a statistic to a named body, survey, or report unless you are certain that source exists and says that. A fabricated citation is far worse than no citation, because it cannot be checked and it will be repeated.
- You have no research tools and no market data. Every figure you write is your estimate, not a finding, and must not be dressed up as one.
- Still commit to concrete numbers so the team has something to plan against, but append [UNVERIFIED] to every figure you cannot source, e.g. "TAM approximately $30M [UNVERIFIED]" or "62% of clinics use paper diaries [UNVERIFIED]".
- End any section containing estimates with a short "To verify" list naming who should confirm each figure before build.

CONSISTENCY RULES:
- The ENFORCED STACK above is the single source of truth. Do not introduce a second framework, database, auth provider, or payment provider anywhere in the document.
- Do not re-implement what a managed service in the stack already provides. If the stack uses a managed auth provider, do NOT define your own users table with a password or password_hash column; model application profile data only and reference the provider's user id as a foreign key.
- Reuse the exact entity, table, field, and endpoint names already established in this document. Never rename the same concept.
- Name only third-party services this product actually uses. If the source material or an earlier section rules a vendor out, or names a required vendor for a job (payments, invoicing, email, hosting), that decision is binding everywhere in the document — including compliance, operations, and test sections. Do not reintroduce a rejected vendor as an example, a DPA counterparty, or a default.`;

// ─── F1: grounding from user-supplied files ─────────────────────────────────
// Without this the pipeline has no input beyond a one-line topic, so every
// fact in the document is invented. Attached briefs, notes, or specs are the
// only real evidence available to it.

interface Attachment {
    name: string;
    text: string;
}

const MAX_GROUNDING_CHARS = 12_000;

function buildGroundingBlock(attachments: Attachment[] | undefined): string {
    if (!attachments?.length) {
        return '';
    }

    const budget = Math.floor(MAX_GROUNDING_CHARS / attachments.length);
    const parts: string[] = [];
    for (const file of attachments) {
        const text = (file.text || '').trim();
        if (!text) {
            continue;
        }
        const clipped =
            text.length > budget ? `${text.slice(0, budget)}\n…[truncated]` : text;
        parts.push(`--- ${file.name} ---\n${clipped}`);
    }
    if (parts.length === 0) {
        return '';
    }

    return `
SOURCE MATERIAL SUPPLIED BY THE USER — this is real evidence and outranks your own assumptions.
Prefer facts, names, numbers, and constraints stated here over anything you would otherwise estimate.
Figures taken from this material do NOT need an [UNVERIFIED] marker; cite them as "per the supplied ${parts.length === 1 ? 'document' : 'documents'}".

${parts.join('\n\n')}
`;
}

// ─── Agent definitions ──────────────────────────────────────────────────────

// Canonical panel lives in @verno/agents. This block used to claim it was
// "identical to extension" while the two had in fact drifted apart.
const DEBATE_AGENTS = PERSONAS.map((p) => ({ id: p.id, role: personaRole(p) }));

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

// ─── LLM Call abstraction ───────────────────────────────────────────────────

const RATE_LIMIT_RETRIES = 6;
const MAX_RATE_LIMIT_WAIT_MS = 75_000;
/** A single completion never legitimately takes this long; past it the socket is hung. */
const REQUEST_TIMEOUT_MS = 120_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Per-run rate-limit state.
 *
 * Free provider tiers cap tokens-per-minute far below what a full document
 * costs (Groq's free tier is 8k TPM against a ~20k-token PRD), so the limit is
 * hit on nearly every run. Reacting to 429s alone was the reason a run could
 * sit for ten minutes: each 429 costs a wasted round trip and then an
 * exponential backoff that routinely overshoots the real refill window.
 *
 * Every response carries the remaining token budget and the exact refill time,
 * so we track them and wait precisely — and only when the next call genuinely
 * does not fit. On a paid key the budget never runs low and nothing ever waits.
 */
interface LLMContext {
    /** Tokens left in the current window, or null when unknown/just refilled. */
    remainingTokens: number | null;
    /** Epoch ms at which the token bucket refills. */
    resetAt: number;
    /** Reports a deliberate wait so the stream can show it instead of stalling. */
    onWait?: (ms: number, reason: string) => void;
}

function newLLMContext(onWait?: (ms: number, reason: string) => void): LLMContext {
    return { remainingTokens: null, resetAt: 0, onWait };
}

/** Records the budget a provider reported, so the next call can plan around it. */
function recordBudget(ctx: LLMContext | undefined, headers: Headers): void {
    if (!ctx) {
        return;
    }
    const remaining = Number(headers.get('x-ratelimit-remaining-tokens'));
    if (Number.isFinite(remaining)) {
        ctx.remainingTokens = remaining;
    }
    const reset = parseDuration(headers.get('x-ratelimit-reset-tokens'));
    if (reset !== null) {
        ctx.resetAt = Date.now() + reset;
    }
}

/** Waits out the refill window when the next call cannot fit in what is left. */
async function awaitBudget(ctx: LLMContext | undefined, estimatedCost: number): Promise<void> {
    if (!ctx || ctx.remainingTokens === null || ctx.remainingTokens >= estimatedCost) {
        return;
    }
    const waitMs = Math.min(Math.max(0, ctx.resetAt - Date.now()) + 500, MAX_RATE_LIMIT_WAIT_MS);
    if (waitMs <= 0) {
        return;
    }
    ctx.onWait?.(waitMs, 'token quota');
    await sleep(waitMs);
    // The window has rolled over; the next response re-measures it.
    ctx.remainingTokens = null;
}

/**
 * Parses a Groq/OpenAI-style duration into milliseconds: "7", "26.587s",
 * "2m52.8s", "1h3m", "547ms".
 *
 * The "ms" suffix is the one that matters most and was previously misread. The
 * old pattern was anchorless with every part optional, so "547ms" matched its
 * minutes group and became 547 MINUTES — nine hours, clamped to the maximum
 * wait. Groq reports a nearly-full token bucket in milliseconds, so the healthy
 * case ("resets in half a second") was being turned into a 75-second stall on
 * every retry. Units are matched longest-first and the whole string must match,
 * so an unrecognised format returns null instead of a plausible-looking number.
 */
const DURATION_UNITS_MS: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};

function parseDuration(value: string | null): number | null {
    if (!value) {
        return null;
    }
    const text = value.trim();

    // A bare number is seconds, per the HTTP Retry-After delay-seconds form.
    const plain = Number(text);
    if (Number.isFinite(plain)) {
        return plain * 1000;
    }

    const parts = text.match(/\d+(?:\.\d+)?(?:ms|[smhd])/gi);
    if (!parts || parts.join('') !== text.replace(/\s+/g, '')) {
        return null;
    }

    let total = 0;
    for (const part of parts) {
        const [, amount, unit] = part.match(/^(\d+(?:\.\d+)?)(ms|[smhd])$/i)!;
        total += Number(amount) * DURATION_UNITS_MS[unit.toLowerCase()];
    }
    return total;
}

/**
 * A rate limit the caller cannot wait out inside this request.
 *
 * Not exported: a Next.js route module may only export its handlers, and the
 * client learns the scope from the `code` on the SSE event rather than the type.
 *
 * `scope` matters to the user: a per-minute cap clears on its own, a daily one
 * means come back tomorrow. The client renders a different message for each,
 * so the distinction has to survive as data rather than prose.
 */
class QuotaError extends Error {
    constructor(message: string, readonly scope: 'day' | 'minute') {
        super(message);
        this.name = 'QuotaError';
    }
}

/** Renders a duration for a human: "13m 12s", "45s". Providers quote raw floats. */
function formatDuration(ms: number | null): string | null {
    if (ms === null || !Number.isFinite(ms) || ms <= 0) {
        return null;
    }
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
    return parts.join(' ') || `${totalSeconds}s`;
}

/**
 * How long to wait after a 429, preferring the server's own guidance.
 *
 * Returns null when the provider says the window will not reopen within
 * MAX_RATE_LIMIT_WAIT_MS. That is a daily or hourly cap rather than the
 * per-minute one, and sitting through six clamped retries only spends another
 * seven minutes to fail anyway — the caller should give up and say so.
 */
function parseRetryDelayMs(headers: Headers, attempt: number): number | null {
    // `retry-after` is the only true retry hint. `x-ratelimit-reset-tokens` is a
    // usable stand-in because it is the per-minute bucket. `reset-requests` is
    // deliberately not consulted: on Groq it counts down a rolling daily window
    // (tens of minutes) and reading it as a retry delay makes a routine
    // per-minute 429 look like an unrecoverable one.
    const advised =
        parseDuration(headers.get('retry-after')) ??
        parseDuration(headers.get('x-ratelimit-reset-tokens'));

    // Some providers state outright that this request will never succeed.
    if (headers.get('x-should-retry') === 'false' && advised === null) {
        return null;
    }

    if (advised !== null) {
        // A small buffer avoids landing exactly on the boundary and re-tripping.
        const withBuffer = advised + 1000;
        return withBuffer > MAX_RATE_LIMIT_WAIT_MS ? null : withBuffer;
    }

    // Exponential backoff when the server gives us nothing to go on.
    return Math.min(2000 * 2 ** attempt, MAX_RATE_LIMIT_WAIT_MS);
}

async function callLLM(
    prompt: string,
    provider: string,
    apiKey: string,
    modelId?: string,
    maxTokens: number = 800,
    ctx?: LLMContext
): Promise<string> {
    // Prompt tokens are roughly a quarter of the character count; the completion
    // can use the whole budget. Both are billed against the same per-minute cap.
    const estimatedCost = Math.ceil(prompt.length / 4) + maxTokens;

    if (provider === 'Anthropic' || provider === 'anthropic') {
        const anthropicRequest = () =>
            fetch('https://api.anthropic.com/v1/messages', {
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
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

        await awaitBudget(ctx, estimatedCost);
        let res = await anthropicRequest();
        // Anthropic rate-limits per minute too, and its keys are the ones users
        // bring themselves — a 429 here must not fail the whole document.
        for (let attempt = 0; attempt < RATE_LIMIT_RETRIES && res.status === 429; attempt++) {
            const waitMs = parseRetryDelayMs(res.headers, attempt);
            if (waitMs === null) {
                break;
            }
            ctx?.onWait?.(waitMs, 'Anthropic rate limit');
            await sleep(waitMs);
            res = await anthropicRequest();
        }
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
            model = modelId !== 'test' && modelId ? modelId : DEFAULT_GROQ_MODEL;
            break;
        case 'Groq':
        case 'groq':
        case 'Meta': // Kept for backwards compatibility
            url = 'https://api.groq.com/openai/v1/chat/completions';
            model = modelId || DEFAULT_GROQ_MODEL;
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
            // Without this a hung socket stalls the whole SSE stream forever.
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    };

    // Spend the known budget before firing: a request we can already tell will
    // 429 costs a round trip and then a backoff that overshoots the real refill.
    await awaitBudget(ctx, estimatedCost);
    let res = await makeRequest(model);
    recordBudget(ctx, res.headers);

    // Rate limiting: free tiers cap tokens-per-minute well below what a full
    // document costs, so a 429 means "wait", not "use a different model".
    // Swapping models mid-document also makes sections stylistically
    // inconsistent, so retry the same one and honour the advised delay.
    for (let attempt = 0; attempt < RATE_LIMIT_RETRIES && res.status === 429; attempt++) {
        const waitMs = parseRetryDelayMs(res.headers, attempt);
        if (waitMs === null) {
            // An hourly or daily cap: waiting is pointless, so stop retrying and
            // let the 429 below produce a message the user can act on.
            break;
        }
        console.warn(
            `[callLLM] 429 on ${model}. Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${RATE_LIMIT_RETRIES}.`
        );
        ctx?.onWait?.(waitMs, `${provider} rate limit`);
        await sleep(waitMs);
        res = await makeRequest(model);
        recordBudget(ctx, res.headers);
    }

    if (res.status === 429) {
        // Daily and per-minute caps need different advice, and telling someone
        // who is out for the day to "wait a minute" just wastes their time.
        // The provider states which one it is, so quote it.
        const detail = await res.text().catch(() => '');
        const perDay = /per day|TPD|RPD/i.test(detail);
        const advice = perDay
            ? `The daily quota for this key is used up. Add your own API key in Settings for a higher limit, or try again tomorrow.`
            : `Wait a minute and try again, or switch to a model with a higher quota in Settings.`;
        // Matches the duration grammar itself so the sentence's full stop is not
        // swallowed into the quoted time ("7m39.648s." → "7m39.648s").
        const stated = detail.match(/Please try again in ((?:\d+(?:\.\d+)?(?:ms|[smhd]))+)/i);
        const retryIn = stated ? formatDuration(parseDuration(stated[1])) : null;
        throw new QuotaError(
            `${provider} rate limit reached for "${model}"${retryIn ? ` (retry in ${retryIn})` : ''}. ${advice}`,
            perDay ? 'day' : 'minute'
        );
    }

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${provider} API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function buildAgentPrompt(
    topic: string,
    agentId: string,
    role: string,
    history: DebateMessage[],
    round: number,
    grounding: string
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
${grounding}
Recent debate:
${historyText}

Round ${round} instructions:
${instruction}

RULES:
- Everything you say must be about THIS topic. Do not import examples, competitors, metrics, or scenarios from an unrelated product domain.
- Be SPECIFIC: name tools, frameworks, numbers, thresholds — not generic advice.
- Every claim needs a concrete example or metric.
- Never invent a citation or attribute a statistic to a named survey or report. Mark figures you cannot source with [UNVERIFIED].
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

const AGENT_SPECIFICS: Record<string, { r1: string; r2: string }> = {
    analyst: {
        r1: "Define 3 distinct, specific user personas (Name, Role, Context, Pain point) grounded in this exact topic. Define a concrete pricing proposal with real numbers appropriate to this market (freemium vs seat-based vs usage-based, with the actual tier prices). State competitive positioning: perform a detailed competitive analysis against at least 5 real products that genuinely compete in THIS product's category — name them specifically, and do not name tools from an unrelated market. Clearly explain why users will switch to our platform and define our unique product moat. Detail GTM launch phases (Alpha, Beta, GA) and the monetization plan.",
        r2: "Refine personas to be highly specific based on feedback. Add measurable KPIs (churn, NPS, activation rate, retention). Finalize the pricing strategy (do not defer this). Design free-tier limits around this product's actual cost drivers so the free tier cannot be abused or turned into a cost sink. Define what MVP success looks like in numbers.",
    },
    architect: {
        r1: "Propose a concrete technical architecture. Describe the exact end-to-end data flow for this product's core operation. Specify scaling rules (how many instances, at what trigger?), expected latency or processing time for the real operations this product performs, and where the bottleneck is. Include an architecture diagram description. CRITICAL: the frontend build tool named in the stack bundles the client only; the API Gateway and backend/worker services MUST NOT be described as running on it. Specify actual backend technologies (e.g., Kong, Supabase Edge Functions, or Node.js/Express). Design core API endpoints (method, path, request/response schema) and authentication flows (OAuth2/JWT, SSO/SAML).",
        r2: "Respond to feasibility concerns. Address failure handling for this product's critical operations: what happens on a mid-operation crash — partial result, retry, or idempotent replay? State explicit performance specs: separate interactive UI/API response latency (target < 200ms p95) from any long-running background job duration, and specify async notification (WebSocket/SSE) wherever a job outlasts a request. Enforce TLS 1.3 minimum for all in-transit encryption.",
    },
    ux: {
        r1: 'Describe 2-3 key user flows for this specific product. Define the primary result/output screen in detail: which metrics are shown, what the information hierarchy and prioritization logic is, and what filtering and sorting are available. Detail the UX wireframe layouts. Specify how the UI handles 5 key states: Default, Loading, Empty, Error, and Mobile/Responsive. Detail accessibility requirements (WCAG 2.1 AA compliance minimum) and localization/language plans.',
        r2: "Refine the primary screen layouts. How are the product's recommendations or next actions presented to the user? Add UI acceptance criteria (load times, mobile breakpoints). Define the error states for this product's real failure modes.",
    },
    developer: {
        r1: 'List the exact tech stack (languages, frameworks, libraries, databases). Define the project structure. What build tools, CI/CD pipeline, and deployment strategy? Estimate implementation complexity for each core feature. Explicitly differentiate the frontend build tool from the backend/gateway execution runtime. Create a Dependency Map detailing every third-party service and package this product actually needs, along with their open-source or commercial licenses and any risk flags.',
        r2: 'Respond to architecture proposals. Identify technical debt risks. Propose a specific testing strategy. What needs to be built in-house vs adopted from open source?',
    },
    pm: {
        r1: 'Define a 3-phase roadmap (MVP, Phase 2, Phase 3) formatted as a Markdown table. Each phase MUST include estimated timelines (e.g., Month 1-2), explicit team resourcing/headcount (e.g., 2 Backend FTEs, 1 Frontend FTE), explicit blockers or dependencies, and a concrete list of scope/features (do not leave feature lists empty!). Do not defer pricing; mandate a pricing decision for MVP. What are the GTM milestones? Define support channels, tiers, SLA response times, and uptime targets (e.g., 99.9% uptime). Design subscription billing lifecycles (Stripe integration).',
        r2: 'Resolve disagreements. Finalize MVP scope and phase feature lists. Ensure the primary screen design, pricing, and architecture diagram are strictly included in the consensus. Define launch criteria. Maintain the Open Questions & Decisions Log (table with owners and due dates).',
    },
    qa: {
        r1: "Define specific test scenarios for this product's core operations. Determine the correct interaction model from the real operation duration: if an operation exceeds a few seconds, require async handling plus notification rather than a blocking request. Define quantitative thresholds for this product's key quality metric (accuracy, delivery success, error rate — whichever applies here). Challenge vague acceptance criteria. Demand that criteria be testable, non-placeholder, and quantitative (operation duration SLA, API response latency target < 200ms p95, rate limiting thresholds). Prohibit placeholder criteria that merely restate a feature name. What monitoring and alerting is needed? Design the Test Plan & QA Strategy.",
        r2: 'Challenge vague acceptance criteria. Define the QA strategy (manual vs automated, load testing). Identify the top 5 things most likely to break in this specific product.',
    },
    techwriter: {
        r1: "Define documentation deliverables. Detail the onboarding strategy (welcome emails, help templates, in-product guidance). What is the exact structure of this product's primary result or recommendation item — which fields it carries, how it is ordered, and what action it prompts?",
        r2: 'Refine the primary output format and onboarding docs based on feedback. Ensure all technical terms have user-facing explanations.',
    },
    security: {
        r1: 'Define the threat model FOR THIS SERVICE: how do you prevent abuse of its most expensive or most sensitive operation (rate limiting, quotas, proof of work)? How do you handle injection and stored XSS in any user-supplied content this product stores and renders? If the product acts on resources a user claims to own, design an explicit ownership-verification workflow to address the abuse and legal risk of acting on resources the user does not control. Define secure deletion of user data, the auth model, and data classification (PII/PHI). Enforce TLS 1.3 minimum for all in-transit encryption. Conduct a STRIDE threat enumeration.',
        r2: 'Provide concrete GDPR implementation details tied to the data this product actually stores (e.g., "Consent banner on signup, auto-delete records after 90 days per Art. 17, DPA with the cloud provider"). Address HIPAA scope: justify whether Protected Health Information (PHI) is processed; if it is not, explicitly state "No PHI handled; HIPAA not applicable" to avoid compliance bloat.',
    },
};

// ─── Document generation (batched) ──────────────────────────────────────────
// A 19-section PRD does not fit in a single completion for any mainstream
// model, so sections are generated in small batches. Each batch is parsed and
// validated independently, and any section a batch failed to produce is
// retried on its own rather than taking the whole document down with it.

// Three, not five. An exhaustive PRD section costs ~1,100 completion tokens and
// a reasoning model spends ~900 more thinking, so five sections did not fit in
// BATCH_MAX_TOKENS: every batch was cut off mid-array and silently lost its
// last two sections. Those then went to the per-section recovery pass, which on
// a per-minute token quota cost several minutes and usually failed anyway.
// Three sections leave real headroom, so batches now complete and the recovery
// pass stays the exception it was meant to be.
const SECTION_BATCH_SIZE = 3;
const BATCH_MAX_TOKENS = 4000;
// A lone retry gets the same budget as a whole batch: it costs the same against
// a per-minute token quota either way, and reasoning models spend a large fixed
// slice of the budget thinking before they emit any content. Under-provisioning
// here made the retry — the last chance to recover a section — always truncate.
const SINGLE_SECTION_MAX_TOKENS = BATCH_MAX_TOKENS;
// How many sections the recovery pass will retry individually. See the comment
// at the retry loop: this bounds the worst case rather than improving the best.
const MAX_SECTION_RETRIES = 6;

/** True for a failure that further calls cannot recover from (quota exhausted). */
function isQuotaError(err: unknown): err is QuotaError {
    return err instanceof QuotaError;
}

function buildSectionBatchPrompt(
    topic: string,
    projectType: string,
    contextBlock: string,
    priorDigest: string,
    specs: SectionSpec[],
    startNumber: number,
    totalSections: number,
    docKind: 'PRD' | 'PLAN'
): string {
    const docName =
        docKind === 'PRD'
            ? 'Product Requirements Document (PRD)'
            : 'Architectural Design and Agile Sprint Plan';
    const roleName =
        docKind === 'PRD' ? 'senior Product Architect' : 'Principal Software Architect and Agile Coach';

    const endNumber = startNumber + specs.length - 1;
    const sectionList = specs
        .map((s, i) => `${startNumber + i}. "${s.title}" — ${s.brief}`)
        .join('\n');

    const scopeLine =
        specs.length === 1
            ? `You are writing section ${startNumber} of ${totalSections} of this document.`
            : `You are writing sections ${startNumber}-${endNumber} of ${totalSections} of this document.`;

    return `You are a ${roleName}. You are producing part of a comprehensive, professional, production-ready ${docName} for the following project:
Topic: "${topic}"
Project Type: "${projectType}"

${stackFor(projectType)}
${contextBlock}${priorDigest}
${scopeLine}
Write ONLY the sections listed below. Do not write any other section, do not repeat sections from other parts of the document, and do not summarise the document as a whole.

Respond ONLY with a valid JSON array. Do not include markdown code fences, do not include any commentary before or after.
The array must contain exactly ${specs.length} element${specs.length === 1 ? '' : 's'}, in the order listed, each strictly matching this structure:
{
  "title": "Section Title",
  "content": "Full section content in markdown format"
}
Use the section titles EXACTLY as written below, in UPPERCASE, with no numbering inside the title.

SECTIONS TO WRITE:
${sectionList}

${QUALITY_RULES}`;
}


const DIGEST_CHARS_PER_SECTION = 260;

/**
 * Summarises the sections already written so later batches stay consistent with
 * the decisions earlier ones made, rather than re-deciding the stack, the data
 * model, or the payment provider from scratch.
 */
function buildPriorDigest(collected: Map<string, PRDSection>, specs: SectionSpec[]): string {
    const written: string[] = [];
    for (const spec of specs) {
        const section = collected.get(titleKey(spec.title));
        if (!section) {
            continue;
        }
        const flat = section.content.replace(/\s+/g, ' ').trim();
        const clipped =
            flat.length > DIGEST_CHARS_PER_SECTION
                ? `${flat.slice(0, DIGEST_CHARS_PER_SECTION)}…`
                : flat;
        written.push(`- ${spec.title}: ${clipped}`);
    }
    if (written.length === 0) {
        return '';
    }

    return `
ALREADY WRITTEN IN THIS DOCUMENT — stay consistent with these decisions and reuse their exact names:
${written.join('\n')}
`;
}

/**
 * Generates every requested section, batch by batch, retrying individually for
 * any section a batch failed to produce. Returns the sections in spec order
 * plus the titles that could not be generated at all.
 */
async function generateSections(
    specs: SectionSpec[],
    topic: string,
    projectType: string,
    contextBlock: string,
    docKind: 'PRD' | 'PLAN',
    provider: string,
    apiKey: string,
    model: string | undefined,
    onProgress: (done: number, total: number) => void,
    ctx?: LLMContext
): Promise<{ sections: PRDSection[]; missing: string[]; stopReason?: string; stopScope?: 'day' | 'minute' }> {
    const collected = new Map<string, PRDSection>();
    // Set once the provider says the quota is gone for good. Every further call
    // would fail the same way, so we stop instead of grinding through the rest
    // of the document and returning a mostly empty one.
    let quotaError: QuotaError | null = null;

    for (let i = 0; i < specs.length && !quotaError; i += SECTION_BATCH_SIZE) {
        const batch = specs.slice(i, i + SECTION_BATCH_SIZE);
        const prompt = buildSectionBatchPrompt(
            topic,
            projectType,
            contextBlock,
            buildPriorDigest(collected, specs),
            batch,
            i + 1,
            specs.length,
            docKind
        );

        try {
            const raw = await callLLM(prompt, provider, apiKey, model, BATCH_MAX_TOKENS, ctx);
            for (const section of extractSections(raw)) {
                const key = titleKey(section.title);
                if (batch.some((s) => titleKey(s.title) === key) && !collected.has(key)) {
                    collected.set(key, section);
                }
            }
        } catch (err) {
            console.warn(`[generateSections] batch starting at section ${i + 1} failed:`, err);
            if (isQuotaError(err)) {
                quotaError = err;
            }
        }

        onProgress(Math.min(i + batch.length, specs.length), specs.length);
    }

    // Per-section retry for anything the batches missed. A lone section has
    // plenty of token headroom, so this almost always closes the gap.
    //
    // Capped, because each retry costs a full batch's worth of the per-minute
    // token quota. Uncapped, a run where several batches failed spent every
    // refill window on retries and appeared frozen for ten minutes or more;
    // shipping the document with a few sections flagged missing beats that.
    const missingSpecs = quotaError
        ? []
        : specs.filter((s) => !collected.has(titleKey(s.title))).slice(0, MAX_SECTION_RETRIES);
    for (const spec of missingSpecs) {
        const index = specs.findIndex((s) => s.title === spec.title) + 1;
        const prompt = buildSectionBatchPrompt(
            topic,
            projectType,
            contextBlock,
            buildPriorDigest(collected, specs),
            [spec],
            index,
            specs.length,
            docKind
        );
        try {
            const raw = await callLLM(prompt, provider, apiKey, model, SINGLE_SECTION_MAX_TOKENS, ctx);
            const recovered = extractSections(raw).find(
                (s) => titleKey(s.title) === titleKey(spec.title)
            );
            if (recovered) {
                collected.set(titleKey(spec.title), recovered);
            }
        } catch (err) {
            console.warn(`[generateSections] retry for "${spec.title}" failed:`, err);
            if (isQuotaError(err)) {
                quotaError = err;
                break;
            }
        }
    }

    // Nothing at all came back and we know why: report the real cause rather
    // than the generic "no usable sections" the caller would otherwise raise.
    if (quotaError && collected.size === 0) {
        throw quotaError;
    }

    const sections: PRDSection[] = [];
    const missing: string[] = [];
    for (const spec of specs) {
        const found = collected.get(titleKey(spec.title));
        // Normalize the title back to the canonical spelling so downstream
        // consumers can rely on it.
        if (found) {
            sections.push({ ...found, title: spec.title });
        } else {
            missing.push(spec.title);
        }
    }

    return {
        sections,
        missing,
        ...(quotaError ? { stopReason: quotaError.message, stopScope: quotaError.scope } : {}),
    };
}

// ─── Security & Compliance pass (mirrors SecurityComplianceService) ──────────
// Keywords are matched on word boundaries and deliberately kept specific:
// broad tokens such as "name" or "personal" appear in nearly every PRD section
// (e.g. "field names") and previously flagged the entire document.

const GDPR_KEYWORDS = [
    'email address', 'phone number', 'ip address', 'home address', 'mailing address',
    'geolocation', 'location data', 'biometric', 'credit card', 'bank account',
    'personal data', 'pii', 'behavioral tracking', 'user profile', 'cookie',
];

const HIPAA_KEYWORDS = [
    'protected health', 'phi', 'medical record', 'patient', 'diagnosis',
    'prescription', 'clinical', 'lab result', 'ehr', 'treatment plan',
    'medication', 'immunization', 'mental health', 'substance abuse', 'genomic',
];


// Sections whose entire purpose is compliance — flagging them just restates
// what the section already covers in depth.
const COMPLIANCE_EXEMPT_SECTIONS = new Set(
    ['DATA HANDLING & PRIVACY', 'SECURITY & THREAT MODEL'].map(titleKey)
);

// Context-specific compliance guidance instead of repeating the same boilerplate
const GDPR_ACTIONS: Record<string, string> = {
    'email address': 'Implement double opt-in for email collection. Add an unsubscribe endpoint. Store the consent timestamp.',
    'phone number': 'Collect only with explicit consent. Provide an opt-out mechanism. Do not use for secondary purposes without re-consent.',
    'ip address': 'IP addresses are PII under GDPR. Anonymize in logs (truncate the last octet). Define a retention period.',
    'home address': 'Add an explicit consent mechanism with purpose limitation. Implement a retention policy (Art. 5) with auto-purge.',
    'mailing address': 'Add an explicit consent mechanism with purpose limitation. Implement a retention policy (Art. 5) with auto-purge.',
    'geolocation': 'Location data requires explicit consent. Implement granularity controls. Allow users to disable tracking.',
    'location data': 'Location data requires explicit consent. Implement granularity controls. Allow users to disable tracking.',
    'biometric': 'Biometric data is a special category under Art. 9. Requires explicit consent and a DPIA before processing.',
    'credit card': 'Do not store raw card data — delegate to a PCI-DSS compliant processor and retain only tokens.',
    'bank account': 'Treat as financial PII: encrypt at rest, restrict access by role, and log every access.',
    'personal data': 'Implement privacy-by-design (Art. 25). A Data Protection Impact Assessment (DPIA) is required if processing at scale.',
    'pii': 'Map all personal data flows. Implement access controls. Designate a Data Protection Officer if required.',
    'behavioral tracking': 'Implement a cookie consent banner (ePrivacy Directive) with granular consent (necessary vs. analytics vs. marketing).',
    'user profile': 'Allow users to view, export, and delete their profile data. Implement the right to data portability (Art. 20).',
    'cookie': 'Cookie banner required. Categorize cookies (essential/functional/analytics/marketing). Respect "Do Not Track".',
};

const HIPAA_ACTIONS: Record<string, string> = {
    'protected health': 'PHI — requires full HIPAA safeguards: AES-256 at rest, TLS 1.3 in transit, BAA with all subprocessors, audit logging.',
    'phi': 'PHI — requires full HIPAA safeguards: AES-256 at rest, TLS 1.3 in transit, BAA with all subprocessors, audit logging.',
    'patient': 'Implement role-based access controls. The minimum necessary standard applies. Audit all PHI access.',
    'medical record': 'Assess whether this data qualifies as PHI. If yes: BAA, encryption, access controls, 6-year retention minimum.',
    'diagnosis': 'PHI — requires full HIPAA safeguards. Implement de-identification (Safe Harbor or Expert Determination).',
};

function matchesKeyword(text: string, keyword: string): boolean {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}s?\\b`, 'i').test(text);
}

function applySecurityPass(sections: PRDSection[]): PRDSection[] {
    return sections.map((section) => {
        if (COMPLIANCE_EXEMPT_SECTIONS.has(titleKey(section.title))) {
            return section;
        }

        const content = section.content || '';
        const lower = content.toLowerCase();
        const flags: string[] = [];

        // Check for negations to prevent false positive flags
        const explicitlyNoPHI =
            /\b(no|zero|without|not\s+handling)\s+(phi|protected\s+health|health\s+data)\b/i.test(lower) ||
            lower.includes('phi: none') ||
            lower.includes('phi is not') ||
            lower.includes('hipaa not applicable');
        const explicitlyNoGDPR =
            /\b(no|zero|without|not\s+handling)\s+(pii|personal\s+data)\b/i.test(lower) ||
            lower.includes('pii: none');

        if (!explicitlyNoGDPR) {
            const hit = GDPR_KEYWORDS.find((kw) => matchesKeyword(content, kw));
            if (hit) {
                const action =
                    GDPR_ACTIONS[hit] ??
                    'Implement consent capture on signup. Define a retention period with auto-deletion (Art. 17). A DPA with cloud providers is required.';
                flags.push(`⚠️ GDPR: "${hit}" detected in "${section.title}" — ${action}`);
            }
        }
        if (!explicitlyNoPHI) {
            const hit = HIPAA_KEYWORDS.find((kw) => matchesKeyword(content, kw));
            if (hit) {
                const action =
                    HIPAA_ACTIONS[hit] ??
                    'Encrypt PHI at rest (AES-256) and in transit (TLS 1.3); enable audit logging; a BAA is required.';
                flags.push(`⚠️ HIPAA: "${hit}" detected in "${section.title}" — ${action}`);
            }
        }

        if (flags.length === 0) {
            return section;
        }
        return { ...section, complianceFlags: [...(section.complianceFlags ?? []), ...flags] };
    });
}

// ─── Format PRD as Markdown ─────────────────────────────────────────────────

function formatPRDMarkdown(title: string, sections: PRDSection[]): string {
    let md = `# PRD: ${title}\n\n`;
    md += `> **Status:** DRAFT — Generated by Producthive Multi-Agent Debate Engine\n\n`;
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

const TITLE_FILLER = /\b(it|i want|create|build|make|develop|design|write|generate|a|an|the|for|to|from|with|and|or|that|which|this|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could)\b/gi;

function generateCleanTitle(rawTopic: string, sections: PRDSection[]): string {
    // Clean up the raw topic first
    let cleaned = rawTopic
        .replace(/[-–—>→]+/g, ' ')           // Remove arrows and dashes
        .replace(/\.\.\./g, ' ')               // Remove ellipsis
        .replace(TITLE_FILLER, ' ')            // Strip filler words
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

    // Title-case it, preserving acronyms that were already fully capitalised
    cleaned = cleaned
        .split(' ')
        .filter((w) => w.length > 0)
        .map((w) =>
            w.length > 1 && w === w.toUpperCase()
                ? w
                : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        )
        .join(' ');

    // If we ended up with something too short or empty, fall back to the
    // opening section of the generated document.
    if (cleaned.length < 5) {
        const lead = sections[0];
        if (lead?.content) {
            const firstSentence = lead.content.replace(/^#+\s*/, '').split(/[.!?\n]/)[0].trim();
            if (firstSentence.length > 5 && firstSentence.length < 80) {
                return firstSentence;
            }
        }
        return 'Product Requirements Document';
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
    const { topic, provider, apiKey, projectType, model, fastTrack, mode, attachments } = body as {
        topic: string;
        provider: string;
        apiKey: string;
        projectType?: string;
        model?: string;
        fastTrack?: boolean;
        mode?: string;
        attachments?: Attachment[];
    };

    if (!topic || !provider || !apiKey) {
        return new Response(JSON.stringify({ error: 'Missing required fields: topic, provider, apiKey' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // The shared key only funds single-PRD generation for signed-in users.
    // Every other mode must be paid for with the caller's own key.
    const guard = await guardSharedKeyUsage(request, {
        provider,
        mode: mode || 'Generate PRD',
    });
    if (!guard.ok) {
        return guard.response!;
    }

    const resolvedProjectType = projectType || 'Full Stack App';
    const isPlanMode = mode === 'Plan';
    const specs = sectionsFor(resolvedProjectType, isPlanMode);
    const docKind: 'PRD' | 'PLAN' = isPlanMode ? 'PLAN' : 'PRD';
    const groundingBlock = buildGroundingBlock(attachments);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseEncode(event, data)));
            };

            const emitProgress = (done: number, total: number) => {
                send('prd-progress', { done, total });
            };

            // A rate-limit wait is the single longest thing that happens in a
            // run on a free key. Announcing it keeps the client showing a
            // countdown rather than a step that looks hung.
            const llm = newLLMContext((waitMs, reason) => {
                send('rate-limit', { waitMs, reason, resumeAt: Date.now() + waitMs });
            });

            const finish = (
                sections: PRDSection[],
                missing: string[],
                history: DebateMessage[],
                roundCount: number,
                stopReason?: string,
                stopScope?: 'day' | 'minute'
            ) => {
                send('phase', { phase: 'security-pass', message: 'Running security & compliance checks...' });
                const withFlags = applySecurityPass(sections);

                const baseTitle = generateCleanTitle(topic, withFlags);
                const docTitle = isPlanMode ? `${baseTitle} (Architecture & Sprint Plan)` : baseTitle;
                const markdown = formatPRDMarkdown(docTitle, withFlags);

                if (missing.length > 0) {
                    // "could not be generated" on its own reads like the model
                    // failed. When the run stopped because the quota ran out,
                    // that is the fact the user needs in order to act.
                    const cause = stopReason
                        ? ` Generation stopped early: ${stopReason}`
                        : '';
                    send('warning', {
                        // Tagged so the chat can drop it: the full section list
                        // plus a provider error string is a wall of text, and the
                        // completion message already reports the incomplete count.
                        // The detail stays on the event for the console and for
                        // anything that wants it.
                        kind: 'missing-sections',
                        message: `${missing.length} section${missing.length === 1 ? '' : 's'} could not be generated: ${missing.join(', ')}.${cause}`,
                        missing,
                        stopReason,
                        code: stopScope === 'day' ? 'daily-quota' : undefined,
                    });
                }

                send('phase', {
                    phase: 'complete',
                    message: isPlanMode ? 'Architecture & Sprint Plan complete!' : 'PRD generation complete!',
                });
                send('prd-complete', {
                    title: docTitle,
                    markdown,
                    sections: withFlags,
                    debateHistory: history,
                    agentCount: history.length > 0 ? DEBATE_AGENTS.length : 1,
                    roundCount,
                    missingSections: missing,
                });
                send('done', { success: true });
                // Only spend the daily allowance once a document actually landed.
                void guard.commit?.();
            };

            try {
                if (fastTrack) {
                    send('phase', {
                        phase: 'prd-gen',
                        message: isPlanMode
                            ? 'Fast Track: Generating Architectural & Sprint Plan...'
                            : 'Fast Track: Generating PRD...',
                    });

                    const { sections, missing, stopReason, stopScope } = await generateSections(
                        specs,
                        topic,
                        resolvedProjectType,
                        groundingBlock,
                        docKind,
                        provider,
                        apiKey,
                        model,
                        emitProgress,
                        llm
                    );

                    if (sections.length === 0) {
                        throw new Error(
                            'The model did not return any usable sections. Try a different model in Settings.'
                        );
                    }

                    finish(sections, missing, [], 1, stopReason, stopScope);
                    return;
                }

                const history: DebateMessage[] = [];

                // ── Phase A: multi-agent debate ───────────────────────────
                // A second round is eight more calls. It is worth that only when
                // the topic has contested surface and round one left something
                // unresolved, so the count is decided from the brief and then
                // re-checked against what the agents actually produced.
                const complexity = topicComplexity(topic);
                let plannedRounds = complexity.simple ? 1 : MAX_DEBATE_ROUNDS;
                let roundsRun = 0;

                send('debate-plan', {
                    plannedRounds,
                    simple: complexity.simple,
                    reason: complexity.reason,
                    agentCount: DEBATE_AGENTS.length,
                });
                send('phase', {
                    phase: 'debate',
                    message: `Starting 8-agent debate (${plannedRounds} round${plannedRounds === 1 ? '' : 's'})...`,
                });

                for (let round = 1; round <= plannedRounds; round++) {
                    send('round', { round, total: plannedRounds });
                    const roundMessages: DebateMessage[] = [];

                    for (const agent of DEBATE_AGENTS) {
                        send('agent-thinking', {
                            agentId: agent.id,
                            agentName: AGENT_DISPLAY_NAMES[agent.id],
                            round,
                        });

                        const prompt = buildAgentPrompt(topic, agent.id, agent.role, history, round, groundingBlock);
                        const response = await callLLM(prompt, provider, apiKey, model, 800, llm);

                        const msg: DebateMessage = {
                            agentId: agent.id,
                            content: response,
                            round,
                            timestamp: Date.now(),
                            type: round === 1 ? 'argument' : 'counter',
                        };
                        history.push(msg);
                        roundMessages.push(msg);

                        send('agent-response', {
                            agentId: agent.id,
                            agentName: AGENT_DISPLAY_NAMES[agent.id],
                            agentColor: AGENT_COLORS[agent.id],
                            content: response,
                            round,
                            type: msg.type,
                        });
                    }

                    roundsRun = round;

                    // Every agent already specific, substantial and non-redundant
                    // means the rebuttal round would mostly restate round one.
                    if (round < plannedRounds) {
                        const scores = scoreRound(
                            roundMessages.map((m) => ({ agentId: m.agentId, content: m.content }))
                        );
                        const settled = roundReachedThreshold(scores);
                        send('debate-scores', {
                            round,
                            threshold: ROUND_SKIP_THRESHOLD,
                            settled,
                            scores: scores.map((sc) => ({
                                agentId: sc.agentId,
                                agentName: AGENT_DISPLAY_NAMES[sc.agentId],
                                score: Number(sc.score.toFixed(2)),
                            })),
                        });
                        if (settled) {
                            const weakest = Math.min(...scores.map((sc) => sc.score));
                            send('round-skipped', {
                                skippedFrom: round + 1,
                                message: `All ${scores.length} agents cleared the debate threshold (lowest ${weakest.toFixed(2)} vs ${ROUND_SKIP_THRESHOLD}). Skipping round ${round + 1}.`,
                            });
                            plannedRounds = round;
                            break;
                        }
                    }
                }

                // ── Phase B: Convergence / PM consensus ───────────────────
                send('phase', { phase: 'consensus', message: 'Reaching consensus...' });

                const convergencePrompt = buildConvergencePrompt(topic, history);
                const convergenceResponse = await callLLM(convergencePrompt, provider, apiKey, model, 600, llm);

                const convergenceMsg: DebateMessage = {
                    agentId: 'pm',
                    content: convergenceResponse,
                    round: roundsRun + 1,
                    timestamp: Date.now(),
                    type: 'consensus',
                };
                history.push(convergenceMsg);

                send('consensus', {
                    agentId: 'pm',
                    agentName: 'Product Manager',
                    agentColor: AGENT_COLORS['pm'],
                    content: convergenceResponse,
                    round: roundsRun + 1,
                    type: 'consensus',
                });

                // ── Phase C: PRD generation ───────────────────────────────
                send('phase', { phase: 'prd-gen', message: 'Generating PRD document...' });

                const lastByAgent = new Map<string, string>();
                for (const m of history) {
                    lastByAgent.set(m.agentId, m.content);
                }
                const condensed = Array.from(lastByAgent.entries())
                    .map(([id, content]) => `[${id.toUpperCase()}]: ${content}`)
                    .join('\n');

                const contextBlock = `${groundingBlock}
AGENT CONSENSUS AND INPUTS:
${condensed}

CRITICAL CONSENSUS RULE:
The sections you write MUST be directly synthesized from the agent consensus above. Do NOT use generic placeholder templates. Every technical stack decision, pricing tier, feature list, and threat mitigation MUST match what the agents debated and agreed upon. Do not invent details that contradict the debate.
`;

                const { sections, missing, stopReason, stopScope } = await generateSections(
                    specs,
                    topic,
                    resolvedProjectType,
                    contextBlock,
                    docKind,
                    provider,
                    apiKey,
                    model,
                    emitProgress,
                    llm
                );

                if (sections.length === 0) {
                    // Never silently collapse the document — surface the failure
                    // and hand back the consensus so the debate is not lost.
                    send('warning', {
                        message:
                            'Section generation failed; falling back to the raw consensus synthesis. Try a different model in Settings.',
                        missing,
                    });
                    finish(
                        [{ title: 'OVERVIEW AND SYNTHESIS', content: convergenceResponse }],
                        missing,
                        history,
                        roundsRun,
                        stopReason,
                        stopScope
                    );
                    return;
                }

                finish(sections, missing, history, roundsRun, stopReason, stopScope);
            } catch (err: any) {
                send('error', {
                    message: err?.message || 'Unknown error during debate',
                    // Lets the client show "come back tomorrow" rather than a
                    // provider error string the user cannot act on.
                    code: isQuotaError(err) && err.scope === 'day' ? 'daily-quota' : undefined,
                });
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
