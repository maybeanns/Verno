/**
 * Who is allowed to use the shared (server-funded) API key, and for what.
 *
 * Both the UI and the API routes read these rules. The UI uses them to disable
 * modes and explain why; the server uses them to enforce. The server check is
 * the one that matters — the UI can be bypassed.
 */

export type OperationalMode = 'Generate PRD' | 'Plan' | 'Develop' | 'SDLC';

export const OPERATIONAL_MODES: OperationalMode[] = [
    'Generate PRD',
    'Plan',
    'Develop',
    'SDLC',
];

/**
 * Only single-document PRD generation runs on our key. The other modes fan out
 * across many more calls (SDLC alone is ~21) and must be funded by the user.
 */
export const FREE_TIER_MODE: OperationalMode = 'Generate PRD';

/** How many free runs an authenticated account gets, and over what window. */
export const FREE_TIER_LIMIT = 1;
export const FREE_TIER_WINDOW = 'day' as const;
export const FREE_TIER_LABEL = '1 PRD per day';

export function modeRequiresOwnKey(mode: string): boolean {
    return mode !== FREE_TIER_MODE;
}

export interface AccessInput {
    mode: string;
    /** True when the request is using the shared server key rather than the user's. */
    usingSharedKey: boolean;
    signedIn: boolean;
    /** Free runs already used in the current window. */
    usedToday?: number;
}

export interface AccessResult {
    allowed: boolean;
    /** Machine-readable so the client can react (open sign-in, open settings). */
    reason?: 'auth-required' | 'quota-exceeded' | 'own-key-required';
    message?: string;
}

/**
 * The single decision function. Returns why access is denied so the caller can
 * show the right next step rather than a generic error.
 */
export function checkAccess({
    mode,
    usingSharedKey,
    signedIn,
    usedToday = 0,
}: AccessInput): AccessResult {
    // A user spending their own key can do anything, signed in or not.
    if (!usingSharedKey) {
        return { allowed: true };
    }

    if (modeRequiresOwnKey(mode)) {
        return {
            allowed: false,
            reason: 'own-key-required',
            message: `${mode} mode needs your own API key. Add one in Settings — the free key only covers ${FREE_TIER_MODE}.`,
        };
    }

    if (!signedIn) {
        return {
            allowed: false,
            reason: 'auth-required',
            message: `Create a free account to generate a PRD without your own API key (${FREE_TIER_LABEL}).`,
        };
    }

    if (usedToday >= FREE_TIER_LIMIT) {
        return {
            allowed: false,
            reason: 'quota-exceeded',
            message: `You have used your free PRD for today. Add your own API key in Settings for unlimited runs, or come back tomorrow.`,
        };
    }

    return { allowed: true };
}

/** Providers a user can bring their own key for. */
export const BYOK_PROVIDERS = [
    'OpenAI',
    'Anthropic',
    'Groq',
    'Google',
    'Mistral AI',
    'DeepSeek',
    'Qwen',
    'Moonshot AI',
    'MiniMax',
] as const;

export type ByokProvider = (typeof BYOK_PROVIDERS)[number];
