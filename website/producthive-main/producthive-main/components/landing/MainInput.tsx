'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic, MicOff, Globe, Lock, Paperclip, Settings,
    ChevronDown, ChevronRight, X, Key, Server, Check,
    Terminal, FileText, Layers, Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ProjectType } from '@/lib/types/agent-types';
import { loadSettings, type SettingsData } from './SettingsPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_TYPES: ProjectType[] = [
    'Full Stack App', 'Mobile App', 'Landing Page', 'Dashboard', 'Portfolio'
];

type OperationalMode = 'Generate PRD' | 'Plan' | 'Develop' | 'SDLC';
const OPERATIONAL_MODES: OperationalMode[] = ['Generate PRD', 'Plan', 'Develop', 'SDLC'];

const MODE_ICONS: Record<OperationalMode, React.ReactNode> = {
    'Generate PRD': <FileText className="w-4 h-4" />,
    'Plan': <Layers className="w-4 h-4" />,
    'Develop': <Terminal className="w-4 h-4" />,
    'SDLC': <Workflow className="w-4 h-4" />
};

const PROJECT_TYPE_DETAILS: Record<ProjectType, { placeholder: string, agents: string[] }> = {
    'Full Stack App': {
        placeholder: "Build me an e-commerce platform with...",
        agents: ["Product Owner", "Scrum Master", "Backend Developer", "Frontend Developer", "Full Stack Developer", "UI/UX Designer", "QA Engineer"]
    },
    'Mobile App': {
        placeholder: "Design a fitness tracking mobile app with...",
        agents: ["Product Owner", "Scrum Master", "Mobile Developer (Lead)", "Mobile Developer", "Backend API Developer", "UI/UX Designer", "Mobile QA Engineer"]
    },
    'Landing Page': {
        placeholder: "Create a high-converting landing page for a SaaS product...",
        agents: ["Product Owner / Marketing Lead", "UI/UX Designer", "Frontend Developer", "Copywriter", "QA / Analytics Tester"]
    },
    'Dashboard': {
        placeholder: "Build an admin dashboard with charts and tables...",
        agents: ["Product Owner", "Frontend Developer", "Backend Developer", "UI/UX Designer", "QA Engineer"]
    },
    'Portfolio': {
        placeholder: "Design a personal portfolio website for a photographer...",
        agents: ["Product Owner", "UI/UX Designer", "Frontend Developer", "Content Strategist / Copywriter"]
    }
};

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    costTier: string;
}

const MODEL_ICONS: Record<string, string> = {
    gemini: '/model_icons/gemini.png',
    llama: '/model_icons/meta for llama.png',
    gpt: '/model_icons/ChatGPT.png',
    claude: '/model_icons/claude.svg',
    kimi: '/model_icons/kimi.png',
    qwen: '/model_icons/Qwen_logo.svg.png', // Fallback for groq models without specific icon
};

function ModelIcon({ model, className = "w-4 h-4" }: { model?: ModelOption | null, className?: string }) {
    if (!model) return <div className={`${className} bg-muted rounded-full`} />;

    const id = model.id.toLowerCase();
    const name = model.name.toLowerCase();

    let src = '';
    if (id.includes('gemini') || name.includes('gemini')) src = MODEL_ICONS.gemini;
    else if (id.includes('llama') || name.includes('llama')) src = MODEL_ICONS.llama;
    else if (id.includes('gpt') || name.includes('gpt')) src = MODEL_ICONS.gpt;
    else if (id.includes('claude') || name.includes('anthropic') || name.includes('claude')) src = MODEL_ICONS.claude;
    else if (id.includes('kimi') || name.includes('kimi')) src = MODEL_ICONS.kimi;
    else if (id.includes('qwen') || name.includes('qwen')) src = MODEL_ICONS.qwen;

    if (!src) return <div className={`${className} bg-primary/20 rounded-full flex items-center justify-center text-[10px] font-bold`}>{model.name[0]}</div>;

    return (
        <img
            src={src}
            alt={model.name}
            className={`${className} object-contain`}
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}

// ── SettingsContent (inline, no separate file needed for layout) ──────────────

function SettingsContent({
    settings,
    onChange,
    onSave,
    saved,
    selectedType,
}: {
    settings: SettingsData;
    onChange: (k: keyof SettingsData, v: string) => void;
    onSave: () => void;
    saved: boolean;
    selectedType: ProjectType;
}) {
    return (
        <div className="p-4 space-y-5">
            {/* Project Agents */}
            <section className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Layers className="w-3 h-3" /> Pre-assigned Agents for {selectedType}
                </div>
                <div className="flex flex-wrap gap-1.5 opacity-80">
                    {PROJECT_TYPE_DETAILS[selectedType].agents.map((agent, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                            {agent}
                        </span>
                    ))}
                </div>
            </section>
            
            <div className="h-px bg-border/60" />

            {/* API Keys */}
            <section className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Key className="w-3 h-3" /> Model Selection & API Keys
                </div>
                
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground/70">Preferred Model Provider</label>
                    <select 
                        value={settings.preferredModel} 
                        onChange={(e) => onChange('preferredModel', e.target.value)}
                        className="w-full px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
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
                            <label className="text-[11px] font-medium text-foreground/70">Groq Model</label>
                            <select 
                                value={settings.groqModel || 'llama-3.3-70b-versatile'} 
                                onChange={(e) => onChange('groqModel', e.target.value)}
                                className="w-full px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                            >
                                <optgroup label="Alibaba Cloud">
                                    <option value="qwen-2.5-32b">qwen/qwen3-32b (via Groq)</option>
                                </optgroup>
                                <optgroup label="Canopy Labs">
                                    <option value="orpheus-arabic-saudi">canopylabs/orpheus-arabic-saudi</option>
                                    <option value="orpheus-v1-english">canopylabs/orpheus-v1-english</option>
                                </optgroup>
                                <optgroup label="Groq">
                                    <option value="compound">groq/compound</option>
                                    <option value="compound-mini">groq/compound-mini</option>
                                </optgroup>
                                <optgroup label="Meta">
                                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                                    <option value="llama-4-scout-17b-16e-i">meta-llama/llama-4-scout-17b-16e-i...</option>
                                    <option value="llama-prompt-guard-2-2">meta-llama/llama-prompt-guard-2-2...</option>
                                    <option value="llama-prompt-guard-2-8">meta-llama/llama-prompt-guard-2-8...</option>
                                </optgroup>
                                <optgroup label="OpenAI (OSS)">
                                    <option value="gpt-oss-120b">openai/gpt-oss-120b</option>
                                    <option value="gpt-oss-20b">openai/gpt-oss-20b</option>
                                    <option value="gpt-oss-safeguard-20b">openai/gpt-oss-safeguard-20b</option>
                                </optgroup>
                            </select>
                        </div>
                        <SettingInput label="Groq API Key" placeholder="gsk_..." value={settings.groqKey} onChange={v => onChange('groqKey', v)} hint="Free at console.groq.com" />
                    </>
                )}
                {settings.preferredModel === 'OpenAI' && (
                    <SettingInput label="OpenAI API Key" placeholder="sk-..." value={settings.openaiKey} onChange={v => onChange('openaiKey', v)} />
                )}
                {settings.preferredModel === 'Qwen' && (
                    <SettingInput label="Qwen API Key" placeholder="sk-..." value={settings.qwenKey} onChange={v => onChange('qwenKey', v)} />
                )}
                {settings.preferredModel === 'Mistral AI' && (
                    <SettingInput label="Mistral API Key" placeholder="..." value={settings.mistralKey} onChange={v => onChange('mistralKey', v)} />
                )}
                {settings.preferredModel === 'Google' && (
                    <SettingInput label="Google Gemini API Key" placeholder="AIza..." value={settings.googleKey} onChange={v => onChange('googleKey', v)} />
                )}
                {settings.preferredModel === 'Moonshot AI' && (
                    <SettingInput label="Moonshot AI API Key" placeholder="sk-..." value={settings.moonshotKey} onChange={v => onChange('moonshotKey', v)} />
                )}
                {settings.preferredModel === 'MiniMax' && (
                    <SettingInput label="MiniMax API Key" placeholder="..." value={settings.minimaxKey} onChange={v => onChange('minimaxKey', v)} />
                )}
                {settings.preferredModel === 'DeepSeek' && (
                    <SettingInput label="DeepSeek API Key" placeholder="sk-..." value={settings.deepseekKey} onChange={v => onChange('deepseekKey', v)} />
                )}
            </section>

            <div className="h-px bg-border/60" />

            {/* Jira */}
            <section className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Server className="w-3 h-3" /> Jira Integration
                </div>
                <SettingInput label="Jira Host" placeholder="https://yourco.atlassian.net" value={settings.jiraHost} onChange={v => onChange('jiraHost', v)} />
                <SettingInput label="Email" placeholder="you@company.com" value={settings.jiraEmail} onChange={v => onChange('jiraEmail', v)} />
                <SettingInput label="API Token" placeholder="ATATT..." value={settings.jiraApiToken} onChange={v => onChange('jiraApiToken', v)} />
                <SettingInput label="Project Key" placeholder="PROJ" value={settings.jiraProjectKey} onChange={v => onChange('jiraProjectKey', v)} />
            </section>

            <button
                onClick={onSave}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${saved
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-foreground text-background hover:opacity-90'
                    }`}
            >
                {saved ? '✓ Saved' : 'Save Settings'}
            </button>
        </div>
    );
}

function SettingInput({ label, placeholder, value, onChange, hint }: {
    label: string; placeholder: string; value: string;
    onChange: (v: string) => void; hint?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">{label}</label>
            <input
                type="password"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-muted/60 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/30"
            />
            {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MainInput() {
    const router = useRouter();

    // Textarea
    const [input, setInput] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedType, setSelectedType] = useState<ProjectType>('Full Stack App');
    const [operationalMode, setOperationalMode] = useState<OperationalMode>('SDLC');
    const [showModes, setShowModes] = useState(false);
    const modeBtnRef = useRef<HTMLButtonElement>(null);

    // Models
    const [models, setModels] = useState<ModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
    const [showModels, setShowModels] = useState(false);
    const modelBtnRef = useRef<HTMLButtonElement>(null);

    // Files
    const [files, setFiles] = useState<File[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Public / Private
    const [isPublic, setIsPublic] = useState(true);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settingsData, setSettingsData] = useState<SettingsData>({
        preferredModel: 'OpenAI',
        groqModel: 'llama-3.3-70b-versatile',
        groqKey: '', openaiKey: '', anthropicKey: '',
        googleKey: '', mistralKey: '', moonshotKey: '',
        minimaxKey: '', deepseekKey: '', qwenKey: '',
        jiraHost: '', jiraEmail: '', jiraApiToken: '', jiraProjectKey: '',
    });
    const [settingsSaved, setSettingsSaved] = useState(false);
    const settingsBtnRef = useRef<HTMLButtonElement>(null);

    // Voice
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Outer wrapper ref — popovers position relative to this
    const wrapperRef = useRef<HTMLDivElement>(null);

    // ── Fetch models ────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then(data => {
                if (data.models?.length) {
                    setModels(data.models);
                    const def = data.models.find((m: ModelOption) => m.id === data.default) ?? data.models[0];
                    setSelectedModel(def);
                }
            })
            .catch(() => {
                const fallback: ModelOption[] = [
                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'vertex', costTier: 'low' },
                    { id: 'gemini-flash', name: 'Gemini 1.5 Flash', provider: 'vertex', costTier: 'low' },
                    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq', costTier: 'free' },
                ];
                setModels(fallback);
                setSelectedModel(fallback[0]);
            });
    }, []);

    // ── Load settings ───────────────────────────────────────────────────
    useEffect(() => {
        setSettingsData(loadSettings());
    }, []);

    // ── Close popovers on outside click ────────────────────────────────
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowModels(false);
                setShowSettings(false);
                setShowModes(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // ── Voice ──────────────────────────────────────────────────────────
    const toggleVoice = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
        if (!SR) { alert('Voice input requires Chrome.'); return; }
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = 'en-US';
        r.onresult = (e: any) => {
            let t = '';
            for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
            setInput(prev => (prev.endsWith(' ') ? prev : prev + ' ') + t);
        };
        r.onerror = r.onend = () => setIsListening(false);
        recognitionRef.current = r;
        r.start();
        setIsListening(true);
    }, [isListening]);

    // ── Save settings ──────────────────────────────────────────────────
    const saveSettings = () => {
        localStorage.setItem('producthive-settings', JSON.stringify(settingsData));
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
    };

    // ── Submit ─────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const userKeys: Record<string, string> = {};
            if (settingsData.groqKey) userKeys['GROQ_API_KEY'] = settingsData.groqKey;
            if (settingsData.openaiKey) userKeys['OPENAI_API_KEY'] = settingsData.openaiKey;
            if (settingsData.anthropicKey) userKeys['ANTHROPIC_API_KEY'] = settingsData.anthropicKey;

            const res = await fetch('/api/prd/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: input.trim(),
                    projectType: selectedType,
                    operationalMode,
                    modelId: selectedModel?.id ?? '',
                    userKeys: Object.keys(userKeys).length ? userKeys : undefined,
                    maxRounds: 3,
                }),
            });

            const data = res.ok ? await res.json() : {};
            const params = new URLSearchParams({
                q: input, type: selectedType, mode: operationalMode,
                ...(data.jobId ? { jobId: data.jobId } : {}),
                ...(selectedModel ? { model: selectedModel.id } : {}),
                visibility: isPublic ? 'public' : 'private',
            });
            router.push(`/workspace?${params}`);
        } catch {
            router.push(`/workspace?${new URLSearchParams({ q: input, type: selectedType, mode: operationalMode })}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────
    return (
        /* Outer wrapper: position:relative, NO overflow restriction */
        <div ref={wrapperRef} className="max-w-3xl mx-auto mb-8 relative z-20">

            {/* ── Main Input Box ─────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`rounded-2xl overflow-hidden border border-border bg-card shadow-xl
                    ${isFocused ? 'ring-1 ring-primary/20' : ''}`}
            >
                {/* Project type tabs */}
                <div className="flex border-b border-border bg-muted/40">
                    {PROJECT_TYPES.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedType(t)}
                            className={`flex-1 py-2 px-1 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5
                                ${selectedType === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {selectedType === t && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                            {t}
                        </button>
                    ))}
                </div>

                {/* Textarea */}
                <form onSubmit={handleSubmit}>
                    <div className="p-4 min-h-[120px]">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder={PROJECT_TYPE_DETAILS[selectedType].placeholder}
                            rows={3}
                            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none outline-none text-sm leading-relaxed"
                            onInput={e => {
                                const t = e.target as HTMLTextAreaElement;
                                t.style.height = 'auto';
                                t.style.height = t.scrollHeight + 'px';
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                        />
                        {/* File chips */}
                        {files.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
                                {files.map((f, i) => (
                                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-md text-[11px] text-muted-foreground">
                                        <Paperclip className="w-3 h-3" />
                                        <span className="max-w-[100px] truncate">{f.name}</span>
                                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                                            <X className="w-3 h-3 hover:text-foreground" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bottom toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">

                        {/* Left side */}
                        <div className="flex items-center gap-1">
                            {/* Attach */}
                            <input ref={fileRef} type="file" multiple className="hidden"
                                accept=".txt,.md,.json,.csv,.pdf,.doc,.docx"
                                onChange={e => {
                                    setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 5));
                                    if (fileRef.current) fileRef.current.value = '';
                                }} />
                            <button type="button" onClick={() => fileRef.current?.click()}
                                title="Attach files"
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <Paperclip className="w-4 h-4" />
                            </button>

                            <div className="w-px h-4 bg-border mx-1" />

                            {/* Operational Mode button */}
                            <button
                                ref={modeBtnRef}
                                type="button"
                                onClick={() => { setShowModes(v => !v); setShowModels(false); setShowSettings(false); }}
                                className={`flex items-center pl-2 pr-2 py-1.5 rounded-lg text-xs font-medium transition-colors border border-transparent min-w-[130px] justify-between box-border
                                    ${showModes
                                        ? 'bg-muted !border-border text-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    {MODE_ICONS[operationalMode]}
                                    <span className="truncate">{operationalMode}</span>
                                </div>
                                <ChevronDown className={`w-3 h-3 opacity-60 flex-shrink-0 transition-transform ${showModes ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Model selector button */}
                            <button
                                ref={modelBtnRef}
                                type="button"
                                onClick={() => { setShowModels(v => !v); setShowSettings(false); setShowModes(false); }}
                                className={`flex items-center pl-2 pr-2 py-1.5 rounded-lg text-xs font-medium transition-colors border border-transparent min-w-[140px] justify-between box-border
                                    ${showModels
                                        ? 'bg-muted !border-border text-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <ModelIcon model={selectedModel} className="w-4 h-4" />
                                    <span className="truncate">{selectedModel?.name ?? 'Select model'}</span>
                                </div>
                                <ChevronDown className={`w-3 h-3 opacity-60 flex-shrink-0 transition-transform ${showModels ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-1">
                            {/* Public / Private */}
                            <button type="button" onClick={() => setIsPublic(v => !v)}
                                title={isPublic ? 'Public repo' : 'Private repo'}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-w-[80px] justify-center box-border
                                    ${isPublic
                                        ? 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        : 'border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                                    }`}>
                                {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                {isPublic ? 'Public' : 'Private'}
                            </button>

                            {/* Settings */}
                            <button
                                ref={settingsBtnRef}
                                type="button"
                                onClick={() => { setShowSettings(v => !v); setShowModels(false); setShowModes(false); }}
                                title="Settings"
                                className={`p-2 rounded-lg transition-colors ${showSettings
                                    ? 'text-primary bg-primary/10'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                <Settings className="w-4 h-4" />
                            </button>

                            {/* Voice */}
                            <button type="button" onClick={toggleVoice}
                                title={isListening ? 'Stop' : 'Voice input'}
                                className={`p-2 rounded-lg transition-colors ${isListening
                                    ? 'text-red-400 bg-red-500/10 animate-pulse'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>

                            {/* Submit */}
                            <button type="submit" disabled={!input.trim() || isSubmitting}
                                title="Generate PRD"
                                className={`p-2 rounded-full transition-all duration-200 ml-1
                                    ${isSubmitting ? 'bg-primary/50 text-background cursor-wait animate-pulse'
                                        : input.trim() ? 'bg-foreground text-background hover:scale-105'
                                            : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>

            {/* ── Model Dropdown Popover ─────────────────────────────── */}
            {/* Absolutely positioned relative to wrapperRef, floating above page layout */}
            <AnimatePresence>
                {showModels && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 top-[calc(100%+6px)] w-full bg-card border border-border rounded-2xl shadow-2xl shadow-black/25 z-50 overflow-hidden"
                    >
                        <div className="p-1.5 grid grid-cols-2 gap-1 max-h-[280px] overflow-y-auto">
                            {models.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => { setSelectedModel(m); setShowModels(false); }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left
                                        ${selectedModel?.id === m.id
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    <ModelIcon model={m} className="w-5 h-5" />
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-medium truncate">{m.name}</span>
                                    </span>
                                    {selectedModel?.id === m.id && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Operational Mode Popover ─────────────────────────────── */}
            <AnimatePresence>
                {showModes && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 top-[calc(100%+6px)] w-48 bg-card border border-border rounded-2xl shadow-2xl shadow-black/25 z-50 overflow-hidden"
                    >
                        <div className="p-1.5 grid grid-cols-1 gap-1">
                            {OPERATIONAL_MODES.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setOperationalMode(m); setShowModes(false); }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left
                                        ${operationalMode === m
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {MODE_ICONS[m]}
                                    <span className="flex-1 font-medium">{m}</span>
                                    {operationalMode === m && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Settings Popover ────────────────────────────────────── */}
            {/* Absolutely positioned relative to wrapperRef, no layout effect */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 top-[calc(100%+6px)] w-full bg-card border border-border rounded-2xl shadow-2xl shadow-black/25 z-50 overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                            <h3 className="text-sm font-semibold text-foreground">Settings</h3>
                            <button onClick={() => setShowSettings(false)}
                                className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            <SettingsContent
                                settings={settingsData}
                                onChange={(k, v) => setSettingsData(prev => ({ ...prev, [k]: v }))}
                                onSave={saveSettings}
                                saved={settingsSaved}
                                selectedType={selectedType}
                            />
                        </div>
                        <div className="px-4 py-2 border-t border-border bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">Keys are stored in your browser only and never sent to our servers.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
