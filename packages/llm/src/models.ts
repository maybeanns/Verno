/**
 * Single source of truth for Groq model ids.
 *
 * These were previously duplicated as string literals across nine files, and
 * had drifted badly: the default (`llama-3.3-70b-versatile`) 404s on current
 * accounts, some option values were truncated ("…-17b-16e-i..."), and the
 * picker in MainInput dropped the vendor prefix entirely ("gpt-oss-120b"
 * instead of "openai/gpt-oss-120b"), so every selection there failed.
 *
 * `/api/models` reads the live catalog when a key is available; this list is
 * what the settings dropdowns fall back to, so every id here must be a real,
 * chat-capable model.
 */

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

export interface GroqModelGroup {
    label: string;
    models: { id: string; label: string }[];
}

export const GROQ_MODEL_GROUPS: GroqModelGroup[] = [
    {
        label: 'OpenAI (OSS)',
        models: [
            { id: 'openai/gpt-oss-120b', label: 'openai/gpt-oss-120b (recommended)' },
            { id: 'openai/gpt-oss-20b', label: 'openai/gpt-oss-20b' },
        ],
    },
    {
        label: 'Groq',
        models: [
            { id: 'groq/compound', label: 'groq/compound' },
            { id: 'groq/compound-mini', label: 'groq/compound-mini' },
        ],
    },
    {
        label: 'Alibaba Cloud',
        models: [
            { id: 'qwen/qwen3.8-27b', label: 'qwen/qwen3.8-27b' },
            { id: 'qwen/qwen3.6-27b', label: 'qwen/qwen3.6-27b' },
        ],
    },
];

/** Flat list of every selectable Groq model id. */
export const GROQ_MODEL_IDS: string[] = GROQ_MODEL_GROUPS.flatMap((g) =>
    g.models.map((m) => m.id)
);
