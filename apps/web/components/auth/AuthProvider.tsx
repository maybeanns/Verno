'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabase, isAuthConfigured } from '@/lib/supabase/client';

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    loading: boolean;
    configured: boolean;
    /** Access token for calling our API routes. */
    accessToken: string | null;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    session: null,
    loading: true,
    configured: false,
    accessToken: null,
    signOut: async () => {},
    refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = getSupabase();
        if (!supabase) {
            setLoading(false);
            return;
        }

        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (active) {
                setSession(data.session);
                setLoading(false);
            }
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next);
            setLoading(false);
        });

        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const signOut = useCallback(async () => {
        await getSupabase()?.auth.signOut();
        setSession(null);
    }, []);

    const refresh = useCallback(async () => {
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            user: session?.user ?? null,
            session,
            loading,
            configured: isAuthConfigured,
            accessToken: session?.access_token ?? null,
            signOut,
            refresh,
        }),
        [session, loading, signOut, refresh]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    return useContext(AuthContext);
}
