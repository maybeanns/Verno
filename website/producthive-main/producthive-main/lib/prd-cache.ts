/**
 * Remembers a finished PRD run.
 *
 * Reopening or sharing a workspace link used to re-run the whole 8-agent
 * debate: several minutes of latency and a burned free-tier run to reproduce a
 * document we already had. The finished run is cached per (prompt, mode, type,
 * model, fastTrack) and replayed instead.
 *
 * Storage is per-browser, so a shared link still generates for the recipient.
 */

const PREFIX = 'producthive:prd:';

export interface PrdRunIdentity {
    query: string;
    mode: string;
    projectType: string;
    model?: string;
    fastTrack?: boolean;
}

export interface CachedPrdRun {
    title: string;
    markdown: string;
    /** Chat transcript, stored as-is; the caller revives its own message shape. */
    messages: unknown[];
    savedAt: number;
}

/** FNV-1a. Keeps keys short and stable regardless of prompt length. */
function hash(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

function storageKey(id: PrdRunIdentity): string {
    const raw = [
        id.query.trim(),
        id.mode,
        id.projectType,
        id.model ?? '',
        id.fastTrack ? '1' : '0',
    ].join('\u0000');
    return `${PREFIX}${hash(raw)}`;
}

export function loadPrdRun(id: PrdRunIdentity): CachedPrdRun | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const raw = localStorage.getItem(storageKey(id));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (typeof parsed?.markdown !== 'string' || !parsed.markdown) {
            return null;
        }
        return {
            title: typeof parsed.title === 'string' ? parsed.title : '',
            markdown: parsed.markdown,
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
            savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
        };
    } catch {
        return null;
    }
}

export function savePrdRun(id: PrdRunIdentity, run: Omit<CachedPrdRun, 'savedAt'>): void {
    if (typeof window === 'undefined') {
        return;
    }
    const key = storageKey(id);
    const payload = JSON.stringify({ ...run, savedAt: Date.now() });
    try {
        localStorage.setItem(key, payload);
    } catch {
        // Out of quota. Drop the other cached runs and keep the newest one
        // rather than losing the run the user is looking at right now.
        try {
            for (const existing of Object.keys(localStorage)) {
                if (existing.startsWith(PREFIX) && existing !== key) {
                    localStorage.removeItem(existing);
                }
            }
            localStorage.setItem(key, payload);
        } catch {
            // Private browsing, or a single run larger than the quota.
        }
    }
}

/** Drops one cached run so the next visit regenerates it. */
export function clearPrdRun(id: PrdRunIdentity): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        localStorage.removeItem(storageKey(id));
    } catch {
        // Nothing to do — the next load simply regenerates.
    }
}
