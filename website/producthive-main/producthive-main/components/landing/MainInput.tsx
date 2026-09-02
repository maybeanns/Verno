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
import { loadSettings, type SettingsData } from '@/lib/settings';
import { DEFAULT_GROQ_MODEL, GROQ_MODEL_GROUPS } from '@/lib/models';
import { extractAttachments, saveAttachments } from '@/lib/attachments';
import { buildWorkspacePath } from '@/lib/workspace-url';
import { checkAccess, modeRequiresOwnKey, OPERATIONAL_MODES, FREE_TIER_LABEL, type OperationalMode } from '@/lib/entitlements';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';
import SettingsForm from '@/components/settings/SettingsForm';

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_TYPES: ProjectType[] = [
    'Full Stack App', 'Mobile App', 'Landing Page', 'Dashboard', 'Portfolio'
];

// Mode list and entitlement rules live in lib/entitlements so the UI and the
// API routes cannot disagree about what the free key covers.

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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MainInput() {
    const router = useRouter();

    // Textarea
    const [input, setInput] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedType, setSelectedType] = useState<ProjectType>('Full Stack App');
    const [operationalMode, setOperationalMode] = useState<OperationalMode>('SDLC');
    // The debate is the product. A PRD is meant to be argued out by the eight
    // agents and then converged by the PM, not written straight through — so
    // Generate PRD runs the full debate, same as SDLC. Only Plan mode skips it:
    // its sections are architecture and sprint breakdowns for a product whose
    // requirements are already settled, so a requirements debate would add cost
    // without adding content.
    const fastTrack = operationalMode === 'Plan';
    const [showModes, setShowModes] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [authReason, setAuthReason] = useState<string | null>(null);
    const [gateMessage, setGateMessage] = useState<string | null>(null);
    const { user } = useAuth();
    const modeBtnRef = useRef<HTMLButtonElement>(null);

    // Models
    const [models, setModels] = useState<ModelOption[]>([]);

    // Files
    const [files, setFiles] = useState<File[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Public / Private
    const [isPublic, setIsPublic] = useState(true);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settingsData, setSettingsData] = useState<SettingsData>({
        preferredModel: 'OpenAI',
        groqModel: DEFAULT_GROQ_MODEL,
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

    // A user counts as "bring your own key" when they have supplied any provider key.
    const hasOwnKey = Boolean(
        settingsData.groqKey || settingsData.openaiKey || settingsData.anthropicKey ||
        settingsData.googleKey || settingsData.mistralKey || settingsData.moonshotKey ||
        settingsData.minimaxKey || settingsData.deepseekKey || settingsData.qwenKey
    );

    // Computed active model based on settings
    const activeModelId = settingsData.preferredModel === 'Groq' ? (settingsData.groqModel || DEFAULT_GROQ_MODEL) : settingsData.preferredModel;
    let activeModel = models.find(m => m.id === activeModelId || m.id.includes(activeModelId) || activeModelId.includes(m.id));
    if (!activeModel) {
        // If not found in the list, construct a fallback
        // We only use the provider name if it's not 'Groq', otherwise we try to use the specific Groq model name
        const fallbackName = settingsData.preferredModel === 'Groq' 
            ? (settingsData.groqModel || 'Groq Model')
            : settingsData.preferredModel;
            
        activeModel = {
            id: activeModelId,
            name: fallbackName,
            provider: settingsData.preferredModel.toLowerCase(),
            costTier: 'free'
        };
    }

    // ── Fetch models ────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then(data => {
                const fetchedModels = Array.isArray(data) ? data : data.models;
                if (fetchedModels && fetchedModels.length > 0) {
                    setModels(fetchedModels);
                } else {
                    throw new Error('No models found');
                }
            })
            .catch(() => {
                const fallback: ModelOption[] = [
                    { id: 'test', name: 'Test (Env Key)', provider: 'test', costTier: 'free' },
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', costTier: 'free' },
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', costTier: 'paid' },
                    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', costTier: 'paid' },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', costTier: 'low' },
                    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', costTier: 'paid' },
                    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq', costTier: 'free' },
                    { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', provider: 'groq', costTier: 'free' },
                    { id: 'moonshot-v1-auto', name: 'Kimi (Moonshot)', provider: 'moonshot', costTier: 'low' },
                ];
                setModels(fallback);
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
        // Block modes the shared key does not fund, before navigating anywhere.
        const gate = checkAccess({
            mode: operationalMode,
            usingSharedKey: !hasOwnKey,
            signedIn: Boolean(user),
        });
        if (!gate.allowed) {
            setIsSubmitting(false);
            if (gate.reason === 'auth-required') {
                setAuthReason(gate.message ?? null);
                setShowAuth(true);
            } else {
                setGateMessage(gate.message ?? null);
                setShowSettings(true);
            }
            return;
        }

        try {
            // Hand any readable attachments to the workspace as source material.
            const { attachments } = await extractAttachments(files);
            saveAttachments(attachments);

            router.push(buildWorkspacePath({
                query: input,
                projectType: selectedType,
                mode: operationalMode,
                fastTrack,
                model: activeModel?.id,
                visibility: isPublic ? 'public' : 'private',
            }));
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
                <div className="flex border-b border-border bg-muted/40 overflow-x-auto md:overflow-x-visible custom-scrollbar">
                    {PROJECT_TYPES.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedType(t)}
                            className={`flex-shrink-0 whitespace-nowrap px-2.5 md:flex-1 md:flex-shrink md:px-1 py-2 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5
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
                    <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-t border-border/50 bg-muted/20">

                        {/* Left side */}
                        <div className="flex items-center gap-1 min-w-0">
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
                                onClick={() => { setShowModes(v => !v); setShowSettings(false); }}
                                className={`flex items-center pl-2 pr-2 py-1.5 rounded-lg text-xs font-medium transition-colors border border-transparent w-[112px] md:w-[140px] flex-shrink-0 justify-between box-border
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

                            {/* Model display */}
                            <div className="hidden md:flex items-center pl-2 pr-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-transparent w-[160px] flex-shrink-0 justify-start box-border select-none">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <ModelIcon model={activeModel} className="w-4 h-4" />
                                    <span className="truncate">{activeModel?.name ?? 'No model selected'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Public / Private */}
                            <button type="button" onClick={() => setIsPublic(v => !v)}
                                title={isPublic ? 'Public repo' : 'Private repo'}
                                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors min-w-[80px] justify-center box-border
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
                                onClick={() => { setShowSettings(v => !v); setShowModes(false); }}
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


            {/* Entitlement hint — reserves its own line so nothing reflows. */}
            <div className="min-h-[18px] mt-2 px-1">
                {modeRequiresOwnKey(operationalMode) && !hasOwnKey && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Key className="w-3 h-3 flex-shrink-0" />
                        {operationalMode} needs your own API key.
                        <button type="button" onClick={() => setShowSettings(true)} className="text-primary hover:underline">
                            Add one in Settings
                        </button>
                    </p>
                )}
                {!modeRequiresOwnKey(operationalMode) && !hasOwnKey && !user && (
                    <p className="text-[11px] text-muted-foreground">
                        {FREE_TIER_LABEL} free with an account.{' '}
                        <button type="button" onClick={() => { setAuthReason(null); setShowAuth(true); }} className="text-primary hover:underline">
                            Create one
                        </button>
                    </p>
                )}
            </div>

            <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} reason={authReason} />

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
                                    title={modeRequiresOwnKey(m) && !hasOwnKey ? 'Requires your own API key' : undefined}
                                    onClick={() => { setOperationalMode(m); setShowModes(false); }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left
                                        ${operationalMode === m
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {MODE_ICONS[m]}
                                    <span className="flex-1 font-medium">{m}</span>
                                    {modeRequiresOwnKey(m) && !hasOwnKey && (
                                        <Key className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                                    )}
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
                        {gateMessage && (
                            <p className="px-4 py-2.5 text-[11px] text-amber-400 bg-amber-500/10 border-b border-amber-500/20">
                                {gateMessage}
                            </p>
                        )}
                        <div className="max-h-[min(420px,60vh)] overflow-y-auto custom-scrollbar">
                            {/* Toolbar controls that are hidden on small screens live here instead. */}
                            <div className="md:hidden px-4 pt-4 space-y-4">
                                <section className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        <Server className="w-3 h-3" />
                                        Active model
                                    </h4>
                                    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border rounded-lg">
                                        <ModelIcon model={activeModel} className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-xs text-foreground truncate">{activeModel?.name ?? 'No model selected'}</span>
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                        Repository visibility
                                    </h4>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 border border-border rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setIsPublic(true)}
                                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                                                ${isPublic ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Globe className="w-3 h-3" />
                                            Public
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsPublic(false)}
                                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                                                ${!isPublic ? 'bg-amber-500/15 text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Lock className="w-3 h-3" />
                                            Private
                                        </button>
                                    </div>
                                </section>
                            </div>

                            <SettingsForm
                                onSaved={(next) => { setSettingsData(next); setGateMessage(null); }}
                                onRequestSignIn={() => { setAuthReason(null); setShowAuth(true); }}
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
