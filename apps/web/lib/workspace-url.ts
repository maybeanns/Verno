/**
 * Canonical workspace URLs.
 *
 * The prompt moves into the path as a readable slug and every value that equals
 * a default is dropped, so the common case collapses from six query parameters
 * to `/workspace/ecommerce-website`.
 *
 * The slug round-trips exactly: literal hyphens are percent-encoded before
 * spaces become hyphens, so the prompt that reaches the debate is character-for
 * -character the one the user typed. A slug that merely "looks close" would
 * silently change what gets generated.
 */

import { DEFAULT_GROQ_MODEL } from '@/lib/models';

export const DEFAULT_PROJECT_TYPE = 'Full Stack App';
export const DEFAULT_MODE = 'Generate PRD';
export const DEFAULT_VISIBILITY = 'public';

/** Short URL codes. The long names stay the app's internal vocabulary. */
const MODE_CODES: Record<string, string> = {
    'Generate PRD': 'prd',
    Plan: 'plan',
    Develop: 'dev',
    SDLC: 'sdlc',
};

const TYPE_CODES: Record<string, string> = {
    'Full Stack App': 'fullstack',
    'Mobile App': 'mobile',
    'Landing Page': 'landing',
    Dashboard: 'dashboard',
    Portfolio: 'portfolio',
};

/** Reverses a code map. Unknown codes pass through so links never hard-fail. */
function fromCode(codes: Record<string, string>, code: string | null): string | null {
    if (!code) {
        return null;
    }
    const match = Object.entries(codes).find(([, c]) => c === code.toLowerCase());
    return match ? match[0] : decodeURIComponent(code);
}

/** Encodes a prompt as a path segment that decodes back to the exact original. */
export function encodePromptSlug(query: string): string {
    const normalized = query.trim().replace(/\s+/g, ' ');
    return encodeURIComponent(normalized)
        .replace(/-/g, '%2D') // protect hyphens the user actually typed
        .replace(/%20/g, '-'); // then spend hyphens on word separation
}

/** Inverse of encodePromptSlug. */
export function decodePromptSlug(slug: string): string {
    const withSpaces = slug.replace(/-/g, ' ');
    try {
        return decodeURIComponent(withSpaces);
    } catch {
        // Hand-edited URL with a malformed escape — use it as typed.
        return withSpaces;
    }
}

/** Structural type for both URLSearchParams and Next's readonly variant. */
export interface ReadableSearchParams {
    get(name: string): string | null;
}

export interface WorkspaceLinkParams {
    query: string;
    projectType?: string;
    mode?: string;
    fastTrack?: boolean;
    model?: string;
    visibility?: string;
    jobId?: string;
}

export function buildWorkspacePath(params: WorkspaceLinkParams): string {
    const parts: string[] = [];

    if (params.projectType && params.projectType !== DEFAULT_PROJECT_TYPE) {
        parts.push(`type=${TYPE_CODES[params.projectType] ?? encodeURIComponent(params.projectType)}`);
    }
    if (params.mode && params.mode !== DEFAULT_MODE) {
        parts.push(`mode=${MODE_CODES[params.mode] ?? encodeURIComponent(params.mode)}`);
    }
    if (params.fastTrack) {
        parts.push('fast=1');
    }
    if (params.model && params.model !== DEFAULT_GROQ_MODEL) {
        // A slash is legal in a query value and far more readable than %2F.
        parts.push(`model=${encodeURIComponent(params.model).replace(/%2F/gi, '/')}`);
    }
    if (params.visibility && params.visibility !== DEFAULT_VISIBILITY) {
        parts.push(`v=${encodeURIComponent(params.visibility)}`);
    }
    if (params.jobId) {
        parts.push(`job=${encodeURIComponent(params.jobId)}`);
    }

    const search = parts.length > 0 ? `?${parts.join('&')}` : '';
    return `/workspace/${encodePromptSlug(params.query)}${search}`;
}

export interface WorkspaceRouteValues {
    query: string;
    projectType: string;
    mode: string;
    fastTrack: boolean;
    model: string;
    visibility: string;
    jobId?: string;
}

/** Reads a `/workspace/[slug]` route back into the values the layout needs. */
export function parseWorkspaceRoute(
    slug: string,
    search: ReadableSearchParams
): WorkspaceRouteValues {
    return {
        query: decodePromptSlug(slug),
        projectType: fromCode(TYPE_CODES, search.get('type')) ?? DEFAULT_PROJECT_TYPE,
        mode: fromCode(MODE_CODES, search.get('mode')) ?? DEFAULT_MODE,
        fastTrack: search.get('fast') === '1',
        model: search.get('model') ?? DEFAULT_GROQ_MODEL,
        visibility: search.get('v') ?? DEFAULT_VISIBILITY,
        jobId: search.get('job') ?? undefined,
    };
}

/**
 * Translates an old `/workspace?q=…` link to the canonical path. Returns null
 * when there is no prompt to work with, so the caller can send them home.
 */
export function legacyWorkspacePath(search: ReadableSearchParams): string | null {
    const query = search.get('q');
    if (!query || !query.trim()) {
        return null;
    }
    return buildWorkspacePath({
        query,
        projectType: search.get('type') ?? undefined,
        mode: search.get('mode') ?? undefined,
        fastTrack: search.get('fastTrack') === 'true',
        model: search.get('model') ?? undefined,
        visibility: search.get('visibility') ?? undefined,
        jobId: search.get('jobId') ?? undefined,
    });
}
