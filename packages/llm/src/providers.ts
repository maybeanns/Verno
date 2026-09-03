/**
 * Where each provider lives and what it defaults to.
 *
 * Previously a switch statement in the web app's debate route and a set of
 * hardcoded URLs across the extension's provider classes. Endpoints and default
 * model ids are data, not control flow, so they live here and both surfaces
 * read the same table.
 *
 * Model ids are carried over verbatim from the previous implementations. They
 * are not verified against any provider's current catalog — see the note on
 * ANTHROPIC.
 */

export interface ProviderSpec {
    /** Canonical id used internally. */
    id: string;
    label: string;
    /** Chat-completions endpoint. */
    url: string;
    /** Model used when the caller does not pick one. */
    defaultModel: string;
    /**
     * True when the endpoint speaks the OpenAI chat-completions wire format.
     * Anthropic is the one that does not.
     */
    openAICompatible: boolean;
    /** Alternate spellings accepted from stored settings and old clients. */
    aliases?: string[];
}

export const PROVIDERS: ProviderSpec[] = [
    {
        id: 'groq',
        label: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        defaultModel: 'openai/gpt-oss-120b',
        openAICompatible: true,
        aliases: ['Groq', 'Meta'], // 'Meta' kept for backwards compatibility
    },
    {
        id: 'openai',
        label: 'OpenAI',
        url: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        openAICompatible: true,
        aliases: ['OpenAI'],
    },
    {
        id: 'google',
        label: 'Google',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        defaultModel: 'gemini-2.5-flash',
        openAICompatible: true,
        aliases: ['Google', 'gemini', 'Gemini'],
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        url: 'https://api.anthropic.com/v1/messages',
        // NOTE: carried over unchanged from the previous implementation. This id
        // predates current Claude releases and is likely worth revisiting.
        defaultModel: 'claude-3-5-sonnet-20240620',
        openAICompatible: false,
        aliases: ['Anthropic'],
    },
    {
        id: 'qwen',
        label: 'Qwen',
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-max',
        openAICompatible: true,
        aliases: ['Qwen'],
    },
    {
        id: 'mistral',
        label: 'Mistral AI',
        url: 'https://api.mistral.ai/v1/chat/completions',
        defaultModel: 'mistral-large-latest',
        openAICompatible: true,
        aliases: ['Mistral AI'],
    },
    {
        id: 'moonshot',
        label: 'Moonshot AI',
        url: 'https://api.moonshot.cn/v1/chat/completions',
        defaultModel: 'moonshot-v1-32k',
        openAICompatible: true,
        aliases: ['Moonshot AI'],
    },
    {
        id: 'minimax',
        label: 'MiniMax',
        url: 'https://api.minimax.chat/v1/chat/completions',
        defaultModel: 'minimax-text-01',
        openAICompatible: true,
        aliases: ['MiniMax'],
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        url: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
        openAICompatible: true,
        aliases: ['DeepSeek'],
    },
];

const LOOKUP = new Map<string, ProviderSpec>();
for (const spec of PROVIDERS) {
    LOOKUP.set(spec.id.toLowerCase(), spec);
    for (const alias of spec.aliases ?? []) {
        LOOKUP.set(alias.toLowerCase(), spec);
    }
}

/** Resolve a provider by id or alias, case-insensitively. Undefined if unknown. */
export function findProvider(provider: string): ProviderSpec | undefined {
    return LOOKUP.get(provider.trim().toLowerCase());
}

/** Resolve a provider, throwing the same message the old switch statements did. */
export function requireProvider(provider: string): ProviderSpec {
    const spec = findProvider(provider);
    if (!spec) {
        throw new Error(`Unsupported provider: ${provider}`);
    }
    return spec;
}
