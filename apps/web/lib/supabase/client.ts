'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client, created lazily so the app still renders when the
 * project is not configured yet. Every caller must handle `null`.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when auth is wired up. Used to hide account UI in unconfigured builds. */
export const isAuthConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
    if (!isAuthConfigured) {
        return null;
    }
    if (!cached) {
        cached = createClient(url!, anonKey!, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });
    }
    return cached;
}
