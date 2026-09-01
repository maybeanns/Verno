'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogOut, Loader2, ShieldCheck, Zap } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';
import SettingsForm from '@/components/settings/SettingsForm';
import { FREE_TIER_LABEL, FREE_TIER_MODE } from '@/lib/entitlements';
import { hasAnyOwnKey, loadSettings, type SettingsData } from '@/lib/settings';
import { authHeaders } from '@/lib/auth-headers';

interface Usage {
    configured: boolean;
    signedIn: boolean;
    email?: string;
    used: number;
    limit: number;
    remaining: number;
}

export default function ProfileContent() {
    const { user, loading, configured, accessToken, signOut } = useAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [settings, setSettings] = useState<SettingsData | null>(null);

    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    const loadUsage = useCallback(async () => {
        try {
            const res = await fetch('/api/usage', { headers: authHeaders(accessToken) });
            if (res.ok) setUsage(await res.json());
        } catch {
            // Advisory only — the profile page still renders without it.
        }
    }, [accessToken]);

    useEffect(() => {
        void loadUsage();
    }, [loadUsage]);

    const byok = settings ? hasAnyOwnKey(settings) : false;

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
                <p className="text-sm text-muted-foreground">
                    Your account, plan, and API keys.
                </p>
            </header>

            {/* Two columns from lg up: the short account and plan cards sit
                beside the tall keys card, so the page fits a laptop screen
                without scrolling. items-start stops the columns stretching
                to a shared height. */}
            <div className="grid gap-6 lg:grid-cols-[2fr_3fr] lg:items-start">

                {/* ---- Left column ---- */}
                <div className="space-y-6">

            {/* ── Account ─────────────────────────────────────────────── */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/40">
                    <h2 className="text-sm font-semibold text-foreground">Account</h2>
                </div>

                <div className="p-5 min-h-[104px] flex flex-col justify-center">
                    {/* `configured` is a build-time flag, so this state is known on the first
                        paint. Checking it before `loading` avoids a spinner that would resize
                        the card once the session resolves. */}
                    {!configured ? (
                        <div className="space-y-1">
                            <p className="text-sm text-foreground">Accounts are not enabled yet</p>
                            <p className="text-xs text-muted-foreground">
                                This deployment has no Supabase project configured, so the free tier is
                                unavailable. Add your own API key below to use every mode.
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                    ) : user ? (
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center flex-shrink-0">
                                    {(user.email ?? '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-foreground truncate">{user.email}</p>
                                    <p className="text-xs text-muted-foreground">Signed in</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void signOut()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                            >
                                <LogOut className="w-3 h-3" />
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-foreground">You are not signed in</p>
                                <p className="text-xs text-muted-foreground">
                                    Create a free account for {FREE_TIER_LABEL}.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAuth(true)}
                                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
                            >
                                Sign in
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Plan & usage ────────────────────────────────────────── */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/40">
                    <h2 className="text-sm font-semibold text-foreground">Plan &amp; usage</h2>
                </div>

                <div className="divide-y divide-border">
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-start gap-3">
                            <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-foreground">{FREE_TIER_MODE}</p>
                                <p className="text-xs text-muted-foreground">
                                    Runs on our shared key. {FREE_TIER_LABEL}.
                                </p>
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums text-right min-w-[110px]">
                            {usage?.signedIn
                                ? `${usage.remaining} of ${usage.limit} left today`
                                : 'Sign in to use'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-foreground">Plan · Develop · SDLC</p>
                                <p className="text-xs text-muted-foreground">
                                    These run many more model calls, so they always use your own key.
                                </p>
                            </div>
                        </div>
                        {byok ? (
                            <span className="text-xs flex-shrink-0 text-green-400">Unlocked</span>
                        ) : (
                            <a
                                href="#api-keys"
                                className="text-xs flex-shrink-0 text-amber-400 hover:underline"
                            >
                                Add a key
                            </a>
                        )}
                    </div>
                </div>
            </section>

                </div>

                {/* ---- Right column ---- */}
                <div className="space-y-6">

            {/* ── Settings ────────────────────────────────────────────── */}
            <section id="api-keys" className="bg-card border border-border rounded-2xl overflow-hidden scroll-mt-24">
                <div className="px-5 py-3 border-b border-border bg-muted/40">
                    <h2 className="text-sm font-semibold text-foreground">API keys &amp; integrations</h2>
                </div>
                <SettingsForm
                    onSaved={(next) => setSettings(next)}
                    onRequestSignIn={() => setShowAuth(true)}
                    showAccount={false}
                    showPlan={false}
                />
                <div className="px-5 py-3 border-t border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground">
                        Keys are stored in your browser only and never sent to our servers.
                    </p>
                </div>
            </section>

                </div>
            </div>

            <AuthModal
                isOpen={showAuth}
                onClose={() => {
                    setShowAuth(false);
                    void loadUsage();
                }}
            />
        </div>
    );
}
