/**
 * User settings (provider choice, BYOK keys, Jira config).
 *
 * This lived inside SettingsPanel.tsx while MainInput.tsx kept a second, subtly
 * different copy of the same form. The two drifted — MainInput's model picker
 * shipped malformed ids that 404'd on every request. One definition now.
 */

import { DEFAULT_GROQ_MODEL } from '@/lib/models';

export interface SettingsData {
    preferredModel: string;
    groqModel: string;
    groqKey: string;
    openaiKey: string;
    anthropicKey: string;
    googleKey: string;
    mistralKey: string;
    moonshotKey: string;
    minimaxKey: string;
    deepseekKey: string;
    qwenKey: string;
    jiraHost: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
}

export const SETTINGS_STORAGE_KEY = 'producthive-settings';

/** Maps a provider name to the settings field holding its key. */
export const PROVIDER_KEY_FIELD: Record<string, keyof SettingsData> = {
    OpenAI: 'openaiKey',
    Anthropic: 'anthropicKey',
    Groq: 'groqKey',
    Google: 'googleKey',
    'Mistral AI': 'mistralKey',
    DeepSeek: 'deepseekKey',
    Qwen: 'qwenKey',
    'Moonshot AI': 'moonshotKey',
    MiniMax: 'minimaxKey',
};

/** Where each provider's key comes from, shown under the input. */
export const PROVIDER_KEY_HINT: Record<string, string> = {
    OpenAI: 'platform.openai.com/api-keys',
    Anthropic: 'console.anthropic.com',
    Groq: 'console.groq.com — free tier available',
    Google: 'aistudio.google.com/apikey — free tier available',
    'Mistral AI': 'console.mistral.ai',
    DeepSeek: 'platform.deepseek.com',
    Qwen: 'dashscope.console.aliyun.com',
    'Moonshot AI': 'platform.moonshot.cn',
    MiniMax: 'platform.minimaxi.com',
};

export function getDefaultSettings(): SettingsData {
    return {
        preferredModel: 'Groq',
        groqModel: DEFAULT_GROQ_MODEL,
        groqKey: '',
        openaiKey: '',
        anthropicKey: '',
        googleKey: '',
        mistralKey: '',
        moonshotKey: '',
        minimaxKey: '',
        deepseekKey: '',
        qwenKey: '',
        jiraHost: '',
        jiraEmail: '',
        jiraApiToken: '',
        jiraProjectKey: '',
    };
}

export function loadSettings(): SettingsData {
    if (typeof window === 'undefined') {
        return getDefaultSettings();
    }
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return raw ? { ...getDefaultSettings(), ...JSON.parse(raw) } : getDefaultSettings();
    } catch {
        return getDefaultSettings();
    }
}

export function persistSettings(settings: SettingsData): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Private browsing or full quota — the session still works in memory.
    }
}

/** True when the user has supplied a key for at least one provider. */
export function hasAnyOwnKey(settings: SettingsData): boolean {
    return Object.values(PROVIDER_KEY_FIELD).some((field) => Boolean(settings[field]));
}

/** The key for the currently selected provider, if any. */
export function keyForSelectedProvider(settings: SettingsData): string {
    const field = PROVIDER_KEY_FIELD[settings.preferredModel];
    return field ? (settings[field] as string) : '';
}
