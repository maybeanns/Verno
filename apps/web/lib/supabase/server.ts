import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { FREE_TIER_LIMIT } from '@/lib/entitlements';

/**
 * Server-side Supabase access for verifying callers and metering the free tier.
 *
 * Usage is counted here, never in the browser, so a user cannot grant
 * themselves more free runs by editing client state.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAuthConfigured = Boolean(url && anonKey);

export interface AuthedUser {
    id: string;
    email: string | null;
}

/** Reads the bearer token from a request, if present. */
export function bearerToken(request: Request): string | null {
    const header = request.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
}

/**
 * Verifies the caller's access token with Supabase. Returns null for anonymous
 * or invalid tokens — never throws, so routes can treat it as "not signed in".
 */
export async function getUserFromRequest(request: Request): Promise<AuthedUser | null> {
    if (!isAuthConfigured) {
        return null;
    }
    const token = bearerToken(request);
    if (!token) {
        return null;
    }

    try {
        const client = createClient(url!, anonKey!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.getUser(token);
        if (error || !data?.user) {
            return null;
        }
        return { id: data.user.id, email: data.user.email ?? null };
    } catch (err) {
        console.warn('[supabase] token verification failed:', err);
        return null;
    }
}

/**
 * Admin client for usage accounting. Falls back to the anon key when no service
 * role key is set, which still works if RLS grants the row owner access.
 */
function adminClient(accessToken?: string): SupabaseClient | null {
    if (!isAuthConfigured) {
        return null;
    }
    if (serviceKey) {
        return createClient(url!, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return createClient(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(accessToken
            ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
            : {}),
    });
}

const USAGE_TABLE = 'free_tier_usage';

function startOfUtcDay(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** How many free runs this user has consumed in the current window. */
export async function getUsedToday(userId: string, accessToken?: string): Promise<number> {
    const client = adminClient(accessToken);
    if (!client) {
        return 0;
    }
    try {
        const { count, error } = await client
            .from(USAGE_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', startOfUtcDay());
        if (error) {
            // Fail closed: an unreadable usage table must not hand out free runs.
            console.warn('[supabase] usage lookup failed:', error.message);
            return FREE_TIER_LIMIT;
        }
        return count ?? 0;
    } catch (err) {
        console.warn('[supabase] usage lookup threw:', err);
        return FREE_TIER_LIMIT;
    }
}

/** Records one consumed free run. Called only after access has been granted. */
export async function recordUsage(
    userId: string,
    mode: string,
    accessToken?: string
): Promise<void> {
    const client = adminClient(accessToken);
    if (!client) {
        return;
    }
    try {
        const { error } = await client.from(USAGE_TABLE).insert({ user_id: userId, mode });
        if (error) {
            console.warn('[supabase] usage insert failed:', error.message);
        }
    } catch (err) {
        console.warn('[supabase] usage insert threw:', err);
    }
}
