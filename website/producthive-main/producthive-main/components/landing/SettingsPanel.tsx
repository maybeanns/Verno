'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Key, Server, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsData {
    preferredModel: string;
    groqModel: string;
    groqKey: string;
    openaiKey: string;
    anthropicKey: string;
    googleKey: string;
    mistralKey: string;
    moonshotKey: string;
    minimaxKey: string;
    deepseekKey: string;
    qwenKey: string;
    jiraHost: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
}

const STORAGE_KEY = 'producthive-settings';

function loadSettings(): SettingsData {
    if (typeof window === 'undefined') return getDefaults();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...getDefaults(), ...JSON.parse(raw) } : getDefaults();
    } catch {
        return getDefaults();
    }
}

function getDefaults(): SettingsData {
    return {
        preferredModel: 'OpenAI',
        groqModel: 'llama-3.3-70b-versatile',
        groqKey: '',
        openaiKey: '',
        anthropicKey: '',
        googleKey: '',
        mistralKey: '',
        moonshotKey: '',
        minimaxKey: '',
        deepseekKey: '',
        qwenKey: '',
        jiraHost: '',
        jiraEmail: '',
        jiraApiToken: '',
        jiraProjectKey: '',
    };
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: SettingsData) => void;
}

export default function SettingsPanel({ isOpen, onClose, onSave }: SettingsPanelProps) {
    const [settings, setSettings] = useState<SettingsData>(getDefaults());
    const [saved, setSaved] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSettings(loadSettings());
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [isOpen, onClose]);

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        onSave(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const update = (key: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={panelRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full bg-card border-x border-b border-border rounded-b-2xl shadow-2xl shadow-black/20 z-10 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                        <h3 className="text-sm font-semibold text-foreground">Settings</h3>
                        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="p-4 space-y-5 max-h-[400px] overflow-y-auto">
                        {/* Model Selection & API Keys Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <Key className="w-3 h-3" />
                                    Model Selection & API Keys
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground/80">Preferred Model Provider</label>
                                <select 
                                    value={settings.preferredModel} 
                                    onChange={(e) => update('preferredModel', e.target.value)}
                                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                >
                                    <option value="Groq">Groq (Multi-model)</option>
                                    <option value="OpenAI">OpenAI</option>
                                    <option value="Qwen">Qwen</option>
                                    <option value="Mistral AI">Mistral AI</option>
                                    <option value="Google">Google (Gemini)</option>
                                    <option value="Moonshot AI">Moonshot AI (Kimi)</option>
                                    <option value="MiniMax">MiniMax</option>
                                    <option value="DeepSeek">DeepSeek</option>
                                </select>
                            </div>

                            {settings.preferredModel === 'Groq' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground/80">Groq Model</label>
                                        <select 
                                            value={settings.groqModel || 'llama-3.3-70b-versatile'} 
                                            onChange={(e) => update('groqModel', e.target.value)}
                                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                        >
                                            <optgroup label="Alibaba Cloud">
                                                <option value="qwen/qwen3-32b">qwen/qwen3-32b (via Groq)</option>
                                            </optgroup>
                                            <optgroup label="Canopy Labs">
                                                <option value="canopylabs/orpheus-arabic-saudi">canopylabs/orpheus-arabic-saudi</option>
                                                <option value="canopylabs/orpheus-v1-english">canopylabs/orpheus-v1-english</option>
                                            </optgroup>
                                            <optgroup label="Groq">
                                                <option value="groq/compound">groq/compound</option>
                                                <option value="groq/compound-mini">groq/compound-mini</option>
                                            </optgroup>
                                            <optgroup label="Meta">
                                                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                                                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                                                <option value="meta-llama/llama-4-scout-17b-16e-i...">meta-llama/llama-4-scout-17b-16e-i...</option>
                                                <option value="meta-llama/llama-prompt-guard-2-2...">meta-llama/llama-prompt-guard-2-2...</option>
                                                <option value="meta-llama/llama-prompt-guard-2-8...">meta-llama/llama-prompt-guard-2-8...</option>
                                            </optgroup>
                                            <optgroup label="OpenAI (OSS)">
                                                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>
                                                <option value="openai/gpt-oss-20b">openai/gpt-oss-20b</option>
                                                <option value="openai/gpt-oss-safeguard-20b">openai/gpt-oss-safeguard-20b</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <InputField label="Groq API Key" placeholder="gsk_..." value={settings.groqKey} onChange={(v) => update('groqKey', v)} hint="Free at console.groq.com" />
                                </>
                            )}
                            {settings.preferredModel === 'OpenAI' && (
                                <InputField label="OpenAI API Key" placeholder="sk-..." value={settings.openaiKey} onChange={(v) => update('openaiKey', v)} />
                            )}
                            {settings.preferredModel === 'Qwen' && (
                                <InputField label="Qwen API Key" placeholder="sk-..." value={settings.qwenKey} onChange={(v) => update('qwenKey', v)} />
                            )}
                            {settings.preferredModel === 'Mistral AI' && (
                                <InputField label="Mistral API Key" placeholder="..." value={settings.mistralKey} onChange={(v) => update('mistralKey', v)} />
                            )}
                            {settings.preferredModel === 'Google' && (
                                <InputField label="Google Gemini API Key" placeholder="AIza..." value={settings.googleKey} onChange={(v) => update('googleKey', v)} />
                            )}
                            {settings.preferredModel === 'Moonshot AI' && (
                                <InputField label="Moonshot AI API Key" placeholder="sk-..." value={settings.moonshotKey} onChange={(v) => update('moonshotKey', v)} />
                            )}
                            {settings.preferredModel === 'MiniMax' && (
                                <InputField label="MiniMax API Key" placeholder="..." value={settings.minimaxKey} onChange={(v) => update('minimaxKey', v)} />
                            )}
                            {settings.preferredModel === 'DeepSeek' && (
                                <InputField label="DeepSeek API Key" placeholder="sk-..." value={settings.deepseekKey} onChange={(v) => update('deepseekKey', v)} />
                            )}
                        </div>

                        <div className="h-px bg-border" />

                        {/* Jira Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <Server className="w-3 h-3" />
                                Jira Integration
                            </div>

                            <InputField
                                label="Jira Host"
                                placeholder="https://your-company.atlassian.net"
                                value={settings.jiraHost}
                                onChange={(v) => update('jiraHost', v)}
                            />
                            <InputField
                                label="Jira Email"
                                placeholder="you@company.com"
                                value={settings.jiraEmail}
                                onChange={(v) => update('jiraEmail', v)}
                            />
                            <InputField
                                label="Jira API Token"
                                placeholder="ATATT..."
                                value={settings.jiraApiToken}
                                onChange={(v) => update('jiraApiToken', v)}
                                hint="Generate at id.atlassian.com/manage-profile/security/api-tokens"
                            />
                            <InputField
                                label="Project Key"
                                placeholder="PROJ"
                                value={settings.jiraProjectKey}
                                onChange={(v) => update('jiraProjectKey', v)}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                            Keys stored in browser only
                        </p>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${saved
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-foreground text-background hover:opacity-90'
                                }`}
                        >
                            {saved ? '✓ Saved' : 'Save'}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function InputField({
    label,
    placeholder,
    value,
    onChange,
    hint,
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    hint?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80">{label}</label>
            <input
                type="password"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
            {hint && (
                <p className="text-[10px] text-muted-foreground/70 leading-tight">{hint}</p>
            )}
        </div>
    );
}

export { loadSettings };
export type { SettingsData };
