'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Mail, Lock, Loader2, Check, AlertCircle } from 'lucide-react';

import { getSupabase, isAuthConfigured } from '@/lib/supabase/client';
import { FREE_TIER_LABEL } from '@/lib/entitlements';

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
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setNotice(null);
            setPassword('');
            setBusy(false);
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

        setBusy(true);
        try {
            if (mode === 'signup') {
                const { data, error: err } = await supabase.auth.signUp({ email, password });
                if (err) throw err;
                // Projects with email confirmation on return a user but no session.
                if (data.user && !data.session) {
                    setNotice('Check your inbox to confirm your email, then sign in.');
                    setMode('signin');
                } else {
                    onClose();
                }
            } else {
                const { error: err } = await supabase.auth.signInWithPassword({ email, password });
                if (err) throw err;
                onClose();
            }
        } catch (err: any) {
            setError(err?.message ?? 'Something went wrong. Try again.');
        } finally {
            setBusy(false);
        }
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
                                disabled={busy || !isAuthConfigured}
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
