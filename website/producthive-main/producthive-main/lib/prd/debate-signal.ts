/**
 * Decides how many debate rounds a topic actually needs.
 *
 * A second round costs eight more agent calls — roughly 16k tokens, which on a
 * free provider tier is minutes of waiting and a meaningful slice of the daily
 * budget. It earns that cost only when round one left something unresolved.
 *
 * Two rules, both cheap and local (no extra model calls, which would defeat the
 * point of saving calls):
 *
 *  1. A trivially simple topic never gets a second round. "a todo app" has no
 *     contested surface for eight specialists to argue over.
 *  2. Otherwise round two runs unless *every* agent already cleared the quality
 *     bar in round one. If all eight produced specific, substantial, non-
 *     redundant material, the rebuttal pass mostly restates it.
 *
 * The scores are heuristic proxies for "did this agent say something concrete
 * and new", not a semantic model. They are deliberately conservative: the
 * default threshold keeps the second round in ambiguous cases, because losing a
 * round of depth is worse than spending one.
 */

// ─── Tunables ───────────────────────────────────────────────────────────────

export const MAX_DEBATE_ROUNDS = 2;

/**
 * Every agent must reach this for round two to be skipped. Calibrated against
 * sample responses: a vague "we should consider scalability and good UX" scores
 * ~0.3, while a response naming Postgres, a 200ms p95 target and a $12 tier
 * scores ~0.7.
 */
export const ROUND_SKIP_THRESHOLD = 0.62;

/**
 * Below this a topic is treated as simple enough for a single round.
 *
 * Set low on purpose: "very simple" should mean a genuinely trivial brief (a
 * todo app, a portfolio), and anything naming even one real subsystem keeps
 * both rounds. Under-spending a round costs depth the user asked for; over-
 * spending one costs tokens, and only one of those is recoverable by re-running.
 */
export const SIMPLE_TOPIC_THRESHOLD = 2;

/** The word budget each agent is told to write to. Used to judge substance. */
const TARGET_WORDS = 150;

// ─── Text utilities ─────────────────────────────────────────────────────────

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
    'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'to',
    'of', 'in', 'on', 'for', 'with', 'as', 'at', 'by', 'from', 'it', 'its',
    'we', 'our', 'you', 'your', 'they', 'their', 'i', 'my', 'will', 'would',
    'can', 'could', 'should', 'may', 'might', 'must', 'have', 'has', 'had',
    'do', 'does', 'did', 'not', 'no', 'so', 'up', 'out', 'about', 'into',
    'over', 'per', 'via', 'each', 'also', 'more', 'most', 'other', 'such',
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s.+#-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Cosine similarity over term-frequency vectors. */
function cosineSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) {
        return 0;
    }
    const countA = new Map<string, number>();
    const countB = new Map<string, number>();
    for (const t of a) countA.set(t, (countA.get(t) ?? 0) + 1);
    for (const t of b) countB.set(t, (countB.get(t) ?? 0) + 1);

    let dot = 0;
    for (const [term, n] of countA) {
        dot += n * (countB.get(term) ?? 0);
    }
    const normA = Math.sqrt([...countA.values()].reduce((s, n) => s + n * n, 0));
    const normB = Math.sqrt([...countB.values()].reduce((s, n) => s + n * n, 0));
    return normA && normB ? dot / (normA * normB) : 0;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ─── Agent response scoring ─────────────────────────────────────────────────

/** Concrete commitments: money, percentages, durations, sizes, counts, versions. */
const CONCRETE_PATTERNS: RegExp[] = [
    /\$\s?\d[\d,.]*/g,                                   // $12, $1,500
    /\b\d+(?:\.\d+)?\s?%/g,                              // 99.9%
    /\b\d+(?:\.\d+)?\s?(?:ms|s|sec|m|min|h|hr|d|days?|weeks?|months?)\b/gi,
    /\b\d+(?:\.\d+)?\s?(?:kb|mb|gb|tb|rps|qps|tps|req|users?|seats?|orders?)\b/gi,
    /\bv?\d+\.\d+(?:\.\d+)?\b/g,                         // 18.3, 1.3
    /\bp\d{2}\b/gi,                                      // p95, p99
];

/** Named technologies and standards — evidence the agent committed to something. */
const NAMED_ENTITY = /\b(?:[A-Z][a-zA-Z0-9]+(?:\.[a-z]{2,4})?|[A-Z]{2,}(?:-[A-Z0-9]+)?)\b/g;

/** Filler that signals the agent avoided deciding. */
const HEDGE_PATTERNS: RegExp[] = [
    /\b(?:should consider|may want|might want|could potentially|as needed|where appropriate)\b/gi,
    /\b(?:tbd|to be determined|to be decided|etc\.?|and so on|among others)\b/gi,
    /\b(?:various|several|some kind of|appropriate|robust|scalable solution|best practices?)\b/gi,
];

function countMatches(text: string, patterns: RegExp[]): number {
    let total = 0;
    for (const pattern of patterns) {
        total += (text.match(pattern) ?? []).length;
    }
    return total;
}

export interface AgentScore {
    agentId: string;
    /** Composite 0..1. Compared against ROUND_SKIP_THRESHOLD. */
    score: number;
    /** Density of numbers, thresholds and named technologies. */
    specificity: number;
    /** How much this adds over what the other agents already said. */
    novelty: number;
    /** Length against the brief's word budget. */
    substance: number;
    /** Density of non-committal filler; subtracted from the composite. */
    hedging: number;
}

/**
 * Scores one agent's response against its peers in the same round.
 *
 * `peers` is every other agent's text for that round, used for the novelty
 * term — an agent restating a colleague adds nothing a second round would fix.
 */
export function scoreAgentResponse(
    agentId: string,
    content: string,
    peers: string[]
): AgentScore {
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount === 0) {
        return { agentId, score: 0, specificity: 0, novelty: 0, substance: 0, hedging: 1 };
    }

    // Per 100 words, so a long vague answer does not out-score a short precise
    // one. Saturates at 8 concrete facts and 12 named entities per 100 words.
    const per100 = 100 / wordCount;
    const concreteDensity = countMatches(content, CONCRETE_PATTERNS) * per100;
    const entityDensity = (content.match(NAMED_ENTITY) ?? []).length * per100;
    const specificity = clamp01(concreteDensity / 8) * 0.6 + clamp01(entityDensity / 12) * 0.4;

    const tokens = tokenize(content);
    const maxSimilarity = peers.length
        ? Math.max(...peers.map((peer) => cosineSimilarity(tokens, tokenize(peer))))
        : 0;
    const novelty = clamp01(1 - maxSimilarity);

    // Full credit at the target length; no bonus for overrunning it.
    const substance = clamp01(wordCount / TARGET_WORDS);

    const hedging = clamp01((countMatches(content, HEDGE_PATTERNS) * per100) / 4);

    const score = clamp01(
        specificity * 0.4 + novelty * 0.3 + substance * 0.2 + (1 - hedging) * 0.1
    );

    return { agentId, score, specificity, novelty, substance, hedging };
}

/** Scores a whole round, giving each agent its peers for the novelty term. */
export function scoreRound(
    responses: { agentId: string; content: string }[]
): AgentScore[] {
    return responses.map((response, i) =>
        scoreAgentResponse(
            response.agentId,
            response.content,
            responses.filter((_, j) => j !== i).map((r) => r.content)
        )
    );
}

/**
 * True when every agent cleared the bar, meaning another round is not worth
 * its cost. Requires all of them: one weak agent is exactly the case a rebuttal
 * round exists to fix.
 */
export function roundReachedThreshold(
    scores: AgentScore[],
    threshold: number = ROUND_SKIP_THRESHOLD
): boolean {
    return scores.length > 0 && scores.every((s) => s.score >= threshold);
}

// ─── Topic complexity ───────────────────────────────────────────────────────

/** Subsystems that each pull in their own requirements, risks and decisions. */
const COMPLEXITY_TERMS = [
    'payment', 'billing', 'subscription', 'checkout', 'invoice',
    'auth', 'authentication', 'sso', 'oauth', 'permission', 'role', 'rbac',
    'realtime', 'real-time', 'websocket', 'streaming', 'notification',
    'multi-tenant', 'multitenant', 'enterprise', 'marketplace', 'workflow',
    'analytics', 'dashboard', 'report', 'search', 'recommendation',
    'integration', 'api', 'webhook', 'sync', 'import', 'export',
    'gdpr', 'hipaa', 'soc2', 'pci', 'compliance', 'audit', 'encryption',
    'mobile', 'offline', 'geolocation', 'tracking', 'delivery', 'logistics',
    'chat', 'messaging', 'video', 'upload', 'storage', 'ai', 'ml',
    'scale', 'scaling', 'inventory', 'booking', 'scheduling', 'moderation',
];

export interface TopicComplexity {
    /** Raw signal count. Compared against SIMPLE_TOPIC_THRESHOLD. */
    score: number;
    simple: boolean;
    /** Human-readable justification, surfaced to the user. */
    reason: string;
}

/**
 * Estimates how much there is to argue about.
 *
 * Counts independent requirement signals rather than length alone: a rambling
 * one-feature prompt is still one feature, while "delivery app with Stripe
 * payments, courier tracking and vendor onboarding" is three subsystems.
 */
export function topicComplexity(topic: string): TopicComplexity {
    const text = topic.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);

    const domainHits = new Set(COMPLEXITY_TERMS.filter((term) => text.includes(term)));
    // Enumerated requirements: "x, y and z" reads as three asks.
    const conjunctions = (text.match(/,|\band\b|\bplus\b|\bwith\b|\bincluding\b/g) ?? []).length;

    // A subsystem counts double: naming "payments" or "delivery" pulls in its
    // own requirements, failure modes and compliance surface, which is exactly
    // the material eight specialists need a second round to argue over.
    let score = domainHits.size * 2 + Math.min(conjunctions, 4);
    if (words.length >= 25) score += 2;
    else if (words.length >= 12) score += 1;

    const simple = score < SIMPLE_TOPIC_THRESHOLD;
    const reason = simple
        ? `Simple brief (${words.length} words, ${domainHits.size} subsystem${domainHits.size === 1 ? '' : 's'}) — one round is enough.`
        : `${domainHits.size} subsystem${domainHits.size === 1 ? '' : 's'} and ${words.length} words — running the full debate.`;

    return { score, simple, reason };
}
