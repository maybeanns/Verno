'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Mail, Lock, Loader2, Check, AlertCircle } from 'lucide-react';

import { getSupabase, isAuthConfigured } from '@/lib/supabase/client';
import Turnstile, { isCaptchaConfigured, type TurnstileHandle } from '@/components/auth/Turnstile';
import { FREE_TIER_LABEL } from '@/lib/entitlements';

/** Google's brand mark. Lucide has no brand icons, and Google requires this one. */
function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 18 18" aria-hidden focusable="false">
            <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
            />
            <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
        </svg>
    );
}

type Mode = 'signin' | 'signup';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Copy explaining why sign-in was requested, when triggered by a gate. */
    reason?: string | null;
}

export default function AuthModal({ isOpen, onClose, reason }: AuthModalProps) {
    const [mode, setMode] = useState<Mode>('signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [oauthBusy, setOauthBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<TurnstileHandle | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setNotice(null);
            setPassword('');
            setBusy(false);
            setOauthBusy(false);
            setCaptchaToken(null);
        }
    }, [isOpen]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        if (isOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setNotice(null);

        const supabase = getSupabase();
        if (!supabase) {
            setError('Accounts are not configured on this deployment yet.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (isCaptchaConfigured && !captchaToken) {
            setError('Complete the human check first.');
            return;
        }

        setBusy(true);
        try {
            // Supabase verifies the token with Cloudflare when captcha protection
            // is enabled on the project. Undefined is ignored when it is not.
            const options = { captchaToken: captchaToken ?? undefined };

            if (mode === 'signup') {
                const { data, error: err } = await supabase.auth.signUp({ email, password, options });
                if (err) throw err;
                // Projects with email confirmation on return a user but no session.
                if (data.user && !data.session) {
                    setNotice('Check your inbox to confirm your email, then sign in.');
                    setMode('signin');
                } else {
                    onClose();
                }
            } else {
                const { error: err } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                    options,
                });
                if (err) throw err;
                onClose();
            }
        } catch (err: any) {
            setError(err?.message ?? 'Something went wrong. Try again.');
        } finally {
            setBusy(false);
            // Turnstile tokens are single-use, so every attempt needs a fresh one.
            captchaRef.current?.reset();
        }
    }

    async function signInWithGoogle() {
        setError(null);
        setNotice(null);

        const supabase = getSupabase();
        if (!supabase) {
            setError('Accounts are not configured on this deployment yet.');
            return;
        }

        setOauthBusy(true);
        // Google returns the user to the page they started from. This URL must be
        // listed under Authentication → URL Configuration in Supabase.
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (err) {
            setError(err.message);
            setOauthBusy(false);
        }
        // On success the browser navigates to Google; this component unmounts.
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                >
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={mode === 'signup' ? 'Create account' : 'Sign in'}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
                            <h2 className="text-sm font-semibold text-foreground">
                                {mode === 'signup' ? 'Create your free account' : 'Welcome back'}
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={submit} className="p-5 space-y-4">
                            {reason && (
                                <p className="text-[12px] leading-relaxed text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
                                    {reason}
                                </p>
                            )}

                            {!isAuthConfigured && (
                                <p className="flex items-start gap-2 text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    Accounts are not configured on this deployment.
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={signInWithGoogle}
                                disabled={busy || oauthBusy || !isAuthConfigured}
                                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-muted/50 border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {oauthBusy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <GoogleIcon className="w-4 h-4" />
                                )}
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-3">
                                <span className="h-px flex-1 bg-border" />
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    or
                                </span>
                                <span className="h-px flex-1 bg-border" />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="auth-email" className="text-xs font-medium text-foreground/80">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        id="auth-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="auth-password" className="text-xs font-medium text-foreground/80">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        id="auth-password"
                                        type="password"
                                        required
                                        minLength={8}
                                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                            </div>

                            <Turnstile
                                ref={captchaRef}
                                onToken={setCaptchaToken}
                                onError={setError}
                                className="flex justify-center"
                            />

                            {error && (
                                <p className="flex items-start gap-2 text-[12px] text-red-400" role="alert">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    {error}
                                </p>
                            )}
                            {notice && (
                                <p className="flex items-start gap-2 text-[12px] text-green-400" role="status">
                                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    {notice}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    busy ||
                                    oauthBusy ||
                                    !isAuthConfigured ||
                                    (isCaptchaConfigured && !captchaToken)
                                }
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            >
                                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {mode === 'signup' ? 'Create account' : 'Sign in'}
                            </button>

                            <p className="text-[11px] text-center text-muted-foreground">
                                {mode === 'signup' ? 'Already have an account?' : 'No account yet?'}{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode(mode === 'signup' ? 'signin' : 'signup');
                                        setError(null);
                                    }}
                                    className="text-primary hover:underline font-medium"
                                >
                                    {mode === 'signup' ? 'Sign in' : 'Create one'}
                                </button>
                            </p>
                        </form>

                        <div className="px-5 py-3 border-t border-border bg-muted/20">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Free accounts include {FREE_TIER_LABEL} using our shared key. Plan, Develop,
                                and SDLC modes need your own API key.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
