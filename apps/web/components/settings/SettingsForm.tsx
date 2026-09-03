'use client';

import { useEffect, useState } from 'react';
import { Key, Server, Check, Eye, EyeOff, User as UserIcon, Sparkles, ExternalLink } from 'lucide-react';

import { DEFAULT_GROQ_MODEL, GROQ_MODEL_GROUPS } from '@verno/llm';
import {
    PROVIDER_KEY_FIELD,
    PROVIDER_KEY_HINT,
    hasAnyOwnKey,
    loadSettings,
    persistSettings,
    type SettingsData,
} from '@/lib/settings';
import { BYOK_PROVIDERS, FREE_TIER_LABEL, FREE_TIER_MODE } from '@/lib/entitlements';
import { useAuth } from '@/components/auth/AuthProvider';

/**
 * The one settings form. Rendered by the navbar panel and by the composer
 * popover, so the two can no longer drift apart.
 */

interface SettingsFormProps {
    onSaved?: (settings: SettingsData) => void;
    onRequestSignIn?: () => void;
    /** The profile page renders its own account and plan cards. */
    showAccount?: boolean;
    showPlan?: boolean;
}

export default function SettingsForm({
    onSaved,
    onRequestSignIn,
    showAccount = true,
    showPlan = true,
}: SettingsFormProps) {
    const [settings, setSettings] = useState<SettingsData>(loadSettings);
    const [saved, setSaved] = useState(false);
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const { user, configured, signOut } = useAuth();

    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    const update = (key: keyof SettingsData, value: string) =>
        setSettings((prev) => ({ ...prev, [key]: value }));

    const save = () => {
        persistSettings(settings);
        onSaved?.(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const activeKeyField = PROVIDER_KEY_FIELD[settings.preferredModel];
    const byok = hasAnyOwnKey(settings);

    return (
        <div className="p-4 space-y-5">
            {/* ── Account ─────────────────────────────────────────────── */}
            {showAccount && configured && (
                <section className="space-y-2">
                    <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <UserIcon className="w-3 h-3" />
                        Account
                    </h4>
                    {user ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/50 border border-border rounded-lg">
                            <div className="min-w-0">
                                <p className="text-xs text-foreground truncate">{user.email}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {FREE_TIER_LABEL} on the shared key
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void signOut()}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            >
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/50 border border-border rounded-lg">
                            <p className="text-[11px] text-muted-foreground">
                                Sign in for {FREE_TIER_LABEL} free.
                            </p>
                            <button
                                type="button"
                                onClick={onRequestSignIn}
                                className="text-[11px] font-medium text-primary hover:underline flex-shrink-0"
                            >
                                Sign in
                            </button>
                        </div>
                    )}
                </section>
            )}

            {/* ── What your key unlocks ───────────────────────────────── */}
            {showPlan && (
            <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Plan
                </h4>
                <div className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                        <span className="text-[11px] text-foreground">{FREE_TIER_MODE}</span>
                        <span className="text-[10px] text-green-400">
                            {FREE_TIER_LABEL} free
                        </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                        <span className="text-[11px] text-foreground">Plan · Develop · SDLC</span>
                        <span className={`text-[10px] ${byok ? 'text-green-400' : 'text-amber-400'}`}>
                            {byok ? 'Unlocked' : 'Needs your own key'}
                        </span>
                    </div>
                </div>
            </section>
            )}

            {/* ── Provider & keys ─────────────────────────────────────── */}
            <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Key className="w-3 h-3" />
                    Model provider &amp; API keys
                </h4>

                <div className="space-y-1">
                    <label htmlFor="pref-provider" className="text-xs font-medium text-foreground/80">
                        Provider
                    </label>
                    <select
                        id="pref-provider"
                        value={settings.preferredModel}
                        onChange={(e) => update('preferredModel', e.target.value)}
                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                        {BYOK_PROVIDERS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {settings.preferredModel === 'Groq' && (
                    <div className="space-y-1">
                        <label htmlFor="groq-model" className="text-xs font-medium text-foreground/80">
                            Groq model
                        </label>
                        <select
                            id="groq-model"
                            value={settings.groqModel || DEFAULT_GROQ_MODEL}
                            onChange={(e) => update('groqModel', e.target.value)}
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        >
                            {GROQ_MODEL_GROUPS.map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                    {group.models.map((m) => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                )}

                {activeKeyField && (
                    <KeyInput
                        id={`key-${activeKeyField}`}
                        label={`${settings.preferredModel} API key`}
                        value={settings[activeKeyField] as string}
                        onChange={(v) => update(activeKeyField, v)}
                        hint={PROVIDER_KEY_HINT[settings.preferredModel]}
                        revealed={!!revealed[activeKeyField]}
                        onToggleReveal={() =>
                            setRevealed((r) => ({ ...r, [activeKeyField]: !r[activeKeyField] }))
                        }
                    />
                )}
            </section>

            {/* ── Jira ────────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Server className="w-3 h-3" />
                    Jira integration
                    <span className="ml-auto normal-case tracking-normal text-[10px] text-muted-foreground/70">
                        Optional
                    </span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                    <TextInput id="jira-host" label="Host" placeholder="you.atlassian.net"
                        value={settings.jiraHost} onChange={(v) => update('jiraHost', v)} />
                    <TextInput id="jira-project" label="Project key" placeholder="PROD"
                        value={settings.jiraProjectKey} onChange={(v) => update('jiraProjectKey', v)} />
                    <TextInput id="jira-email" label="Email" placeholder="you@company.com"
                        value={settings.jiraEmail} onChange={(v) => update('jiraEmail', v)} />
                    <KeyInput id="jira-token" label="API token" value={settings.jiraApiToken}
                        onChange={(v) => update('jiraApiToken', v)}
                        revealed={!!revealed.jiraApiToken}
                        onToggleReveal={() => setRevealed((r) => ({ ...r, jiraApiToken: !r.jiraApiToken }))} />
                </div>
            </section>

            <button
                type="button"
                onClick={save}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
                {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save settings'}
            </button>
        </div>
    );
}

function TextInput({ id, label, value, onChange, placeholder }: {
    id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs font-medium text-foreground/80">{label}</label>
            <input
                id={id}
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
        </div>
    );
}

function KeyInput({ id, label, value, onChange, hint, revealed, onToggleReveal }: {
    id: string; label: string; value: string; onChange: (v: string) => void;
    hint?: string; revealed: boolean; onToggleReveal: () => void;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs font-medium text-foreground/80">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    type={revealed ? 'text' : 'password'}
                    value={value}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste your key"
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 transition-all font-mono"
                />
                <button
                    type="button"
                    onClick={onToggleReveal}
                    aria-label={revealed ? 'Hide key' : 'Show key'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                    {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            </div>
            {hint && (
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                    {hint}
                </p>
            )}
        </div>
    );
}
