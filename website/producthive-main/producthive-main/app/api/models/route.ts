import { NextResponse } from 'next/server';

/**
 * GET /api/models — the model picker's catalog.
 *
 * This list used to be hard-coded, which meant it drifted from what a given
 * Groq account can actually call: it advertised models that 404, two ids that
 * had been visibly truncated ("…-17b-16e-i..."), and — worse for output
 * quality — speech models and safety classifiers presented as PRD models.
 * Selecting one of those produced either an error or unusable text.
 *
 * The Groq catalog is now read live and filtered to models that can actually
 * write a document. The static list is only a fallback for when no key is
 * configured or the API is unreachable.
 */

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    costTier: 'free' | 'paid';
}

/** Models that exist but cannot write prose: speech, moderation, guard rails. */
const NON_CHAT_PATTERNS = [
    /whisper/i,
    /^playai-tts/i,
    /\btts\b/i,
    /orpheus/i,
    /prompt-guard/i,
    /safeguard/i,
    /guard/i,
];

function isChatModel(id: string): boolean {
    return !NON_CHAT_PATTERNS.some((re) => re.test(id));
}

/** Turns "meta-llama/llama-4-scout-17b-16e-instruct" into "Llama 4 Scout 17B 16E Instruct". */
function prettyName(id: string): string {
    const tail = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
    return tail
        // Split on separators, but keep decimal versions intact ("qwen3.6" not "Qwen3 6").
        .split(/[-_]|\.(?!\d)/)
        .filter(Boolean)
        .map((part) => {
            if (/^\d/.test(part)) {
                return part.toUpperCase();
            }
            if (part.length <= 3) {
                return part.toUpperCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(' ');
}

/** Non-Groq entries, which need the user's own key and cannot be probed here. */
const OTHER_PROVIDER_MODELS: ModelOption[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', costTier: 'free' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', costTier: 'paid' },
];

/** Used only when the live catalog is unavailable. */
const FALLBACK_GROQ_MODELS: ModelOption[] = [
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', costTier: 'free' },
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', provider: 'groq', costTier: 'free' },
    { id: 'groq/compound', name: 'Groq Compound', provider: 'groq', costTier: 'free' },
    { id: 'groq/compound-mini', name: 'Groq Compound Mini', provider: 'groq', costTier: 'free' },
];

async function fetchGroqModels(apiKey: string): Promise<ModelOption[] | null> {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            // The catalog changes rarely; avoid a round trip on every page load.
            next: { revalidate: 3600 },
        });
        if (!res.ok) {
            console.warn(`[api/models] Groq catalog request failed (${res.status})`);
            return null;
        }
        const data = await res.json();
        if (!Array.isArray(data?.data)) {
            return null;
        }

        const models = data.data
            .map((m: { id?: unknown }) => (typeof m.id === 'string' ? m.id : null))
            .filter((id: string | null): id is string => !!id && isChatModel(id))
            .sort()
            .map((id: string) => ({
                id,
                name: prettyName(id),
                provider: 'groq' as const,
                costTier: 'free' as const,
            }));

        return models.length > 0 ? models : null;
    } catch (err) {
        console.warn('[api/models] Groq catalog unreachable:', err);
        return null;
    }
}

export async function GET() {
    const envKey = process.env.GROQ_API_KEY;

    const groqModels = envKey ? await fetchGroqModels(envKey) : null;
    const resolvedGroq = groqModels ?? FALLBACK_GROQ_MODELS;

    const models: ModelOption[] = [
        // Only offer the shared env key when there is actually one to use.
        ...(envKey
            ? [{ id: 'test', name: 'Test (Env Key)', provider: 'test' as const, costTier: 'free' as const }]
            : []),
        ...resolvedGroq,
        ...OTHER_PROVIDER_MODELS,
    ];

    return NextResponse.json(models);
}
