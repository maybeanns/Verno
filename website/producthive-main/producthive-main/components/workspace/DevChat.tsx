'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, Sparkles, Check, AlertCircle, ChevronRight, Code2, Layers, Shield, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadSettings } from '@/components/landing/SettingsPanel';
import type { GeneratedFile } from './CodePanel';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'agent';
    content: string;
    agentName?: string;
    agentColor?: string;
    timestamp: Date;
}

interface ThinkingStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'done' | 'error';
    icon: React.ReactNode;
}

interface DevChatProps {
    query: string;
    projectType: string;
    onFilesGenerated: (files: GeneratedFile[]) => void;
    onFileStreaming: (path: string | null) => void;
    onGeneratingChange: (generating: boolean) => void;
    onProjectNameChange: (name: string) => void;
}

// ── Step definitions ─────────────────────────────────────────────────────────

const CODEGEN_STEPS: Omit<ThinkingStep, 'status'>[] = [
    { id: 'architect', label: 'Planning architecture', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'codegen', label: 'Generating code files', icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Security review', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'complete', label: 'Build complete', icon: <Package className="w-3.5 h-3.5" /> },
];

// ── Provider detection (reused from WorkspaceChat) ───────────────────────────

function detectProvider(): { provider: string; apiKey: string; model?: string } | null {
    const s = loadSettings();
    if (!s.preferredModel) return null;
    if (s.preferredModel === 'test') return { provider: 'test', apiKey: 'test', model: 'llama-3.3-70b-versatile' };
    if (s.preferredModel === 'Groq' && s.groqKey) return { provider: 'Groq', apiKey: s.groqKey, model: s.groqModel || 'llama-3.3-70b-versatile' };
    if (s.preferredModel === 'OpenAI' && s.openaiKey) return { provider: 'OpenAI', apiKey: s.openaiKey };
    if (s.preferredModel === 'Qwen' && s.qwenKey) return { provider: 'Qwen', apiKey: s.qwenKey };
    if (s.preferredModel === 'Mistral AI' && s.mistralKey) return { provider: 'Mistral AI', apiKey: s.mistralKey };
    if (s.preferredModel === 'Google' && s.googleKey) return { provider: 'Google', apiKey: s.googleKey };
    if (s.preferredModel === 'Moonshot AI' && s.moonshotKey) return { provider: 'Moonshot AI', apiKey: s.moonshotKey };
    if (s.preferredModel === 'MiniMax' && s.minimaxKey) return { provider: 'MiniMax', apiKey: s.minimaxKey };
    if (s.preferredModel === 'DeepSeek' && s.deepseekKey) return { provider: 'DeepSeek', apiKey: s.deepseekKey };
    if (s.groqKey) return { provider: 'Meta', apiKey: s.groqKey };
    if (s.openaiKey) return { provider: 'OpenAI', apiKey: s.openaiKey };
    if (s.anthropicKey) return { provider: 'Anthropic', apiKey: s.anthropicKey };
    return null;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DevChat({
    query,
    projectType,
    onFilesGenerated,
    onFileStreaming,
    onGeneratingChange,
    onProjectNameChange,
}: DevChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [steps, setSteps] = useState<ThinkingStep[]>(
        CODEGEN_STEPS.map(s => ({ ...s, status: 'pending' as const }))
    );
    const [buildDone, setBuildDone] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [fileProgress, setFileProgress] = useState<{ current: number; total: number } | null>(null);
    const [currentFileName, setCurrentFileName] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const generatedFilesRef = useRef<GeneratedFile[]>([]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, steps]);

    // ── Auto-start code generation ──────────────────────────────────────

    useEffect(() => {
        setMessages([{ id: 'init', role: 'user', content: query, timestamp: new Date() }]);
        const creds = detectProvider();
        if (!creds) {
            setErrorMsg('No API key configured. Open Settings and add a key.');
            setSteps(prev => prev.map(s => ({ ...s, status: 'error' as const })));
            setMessages(prev => [...prev, {
                id: 'err-key', role: 'system',
                content: '⚠️ No API key found. Please configure one in Settings.',
                timestamp: new Date(),
            }]);
            return;
        }
        setSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
        onGeneratingChange(true);
        const controller = new AbortController();
        abortRef.current = controller;
        runCodegenStream(creds.provider, creds.apiKey, controller.signal, creds.model);
        return () => { controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── SSE Stream handler ──────────────────────────────────────────────

    async function runCodegenStream(provider: string, apiKey: string, signal: AbortSignal, model?: string) {
        try {
            const res = await fetch('/api/codegen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: query,
                    provider,
                    apiKey,
                    projectType,
                    model,
                }),
                signal,
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`API error ${res.status}: ${errText}`);
            }
            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            handleSSEEvent(currentEvent, JSON.parse(line.slice(6)));
                        } catch { }
                        currentEvent = '';
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setErrorMsg(err.message || 'Code generation failed');
            setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s));
            setMessages(prev => [...prev, {
                id: 'err-stream', role: 'system',
                content: `❌ ${err.message}`,
                timestamp: new Date(),
            }]);
            onGeneratingChange(false);
        }
    }

    function handleSSEEvent(event: string, data: any) {
        switch (event) {
            case 'phase': {
                const stepMap: Record<string, number> = {
                    architect: 0, codegen: 1, security: 2, complete: 3
                };
                const idx = stepMap[data.phase];
                if (idx !== undefined) {
                    setSteps(prev => prev.map((s, i) => ({
                        ...s,
                        status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
                    })));
                }
                if (data.phase === 'complete') {
                    setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
                }
                break;
            }

            case 'agent-thinking': {
                setMessages(prev => [...prev, {
                    id: `think-${Date.now()}`,
                    role: 'agent',
                    agentName: data.agentName,
                    agentColor: data.agentColor,
                    content: `Analyzing requirements...`,
                    timestamp: new Date(),
                }]);
                break;
            }

            case 'architecture': {
                onProjectNameChange(data.projectName || 'my-app');
                const fileList = (data.files || []).map((f: any) => f.path).join(', ');
                setMessages(prev => [...prev, {
                    id: `arch-${Date.now()}`,
                    role: 'assistant',
                    content: `**Project:** ${data.projectName}\n${data.description || ''}\n\n**Files planned:** ${data.files?.length || 0}\n${data.componentTree ? `**Component tree:** ${data.componentTree}` : ''}`,
                    timestamp: new Date(),
                }]);
                break;
            }

            case 'file-start': {
                setCurrentFileName(data.path);
                setFileProgress({ current: data.index + 1, total: data.total });
                onFileStreaming(data.path);
                setMessages(prev => [...prev, {
                    id: `fstart-${Date.now()}`,
                    role: 'system',
                    content: `📝 Generating ${data.path} (${data.index + 1}/${data.total})`,
                    timestamp: new Date(),
                }]);
                break;
            }

            case 'file-complete': {
                const file: GeneratedFile = {
                    path: data.path,
                    content: data.content,
                    language: data.language,
                };
                generatedFilesRef.current = [...generatedFilesRef.current, file];
                onFilesGenerated([...generatedFilesRef.current]);
                onFileStreaming(null);
                setCurrentFileName(null);
                break;
            }

            case 'security-report': {
                if (data.issues && data.issues.length > 0) {
                    setMessages(prev => [...prev, {
                        id: `sec-${Date.now()}`,
                        role: 'agent',
                        agentName: 'Security Engineer',
                        agentColor: '#F97316',
                        content: data.issues.join('\n'),
                        timestamp: new Date(),
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        id: `sec-ok-${Date.now()}`,
                        role: 'system',
                        content: '✅ Security scan passed — no issues found',
                        timestamp: new Date(),
                    }]);
                }
                break;
            }

            case 'codegen-complete': {
                setBuildDone(true);
                onGeneratingChange(false);
                setMessages(prev => [...prev, {
                    id: 'complete',
                    role: 'system',
                    content: `✅ Build complete! ${data.totalFiles} files generated. View them in the code panel.`,
                    timestamp: new Date(),
                }]);
                break;
            }

            case 'error': {
                setErrorMsg(data.message);
                setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s));
                setMessages(prev => [...prev, {
                    id: `err-${Date.now()}`, role: 'system',
                    content: `❌ ${data.message}`,
                    timestamp: new Date(),
                }]);
                onGeneratingChange(false);
                break;
            }
        }
    }

    // ── Follow-up handler ───────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSubmitting) return;
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        const userInput = input.trim();
        setInput('');
        setIsSubmitting(true);

        // For follow-up prompts, regenerate with context
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: `resp-${Date.now()}`,
                role: 'assistant',
                content: getFollowUpReply(userInput),
                timestamp: new Date(),
            }]);
            setIsSubmitting(false);
        }, 1000);
    };

    // ── Render ───────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.map(msg => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                        {msg.role === 'user' && (
                            <div className="bg-white/[0.05] rounded-xl px-4 py-3 text-[13px] text-white/80 leading-relaxed border border-white/[0.06]">
                                {msg.content}
                            </div>
                        )}

                        {msg.role === 'system' && (
                            <div className="text-[12px] text-white/40 py-1">{msg.content}</div>
                        )}

                        {(msg.role === 'agent' || msg.role === 'assistant') && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                        style={{ backgroundColor: msg.agentColor ?? '#DD830A' }}
                                    >
                                        {msg.role === 'agent' ? (msg.agentName?.[0] ?? 'A') : '✦'}
                                    </div>
                                    <span className="text-[13px] font-semibold text-white/90">
                                        {msg.role === 'agent' ? msg.agentName : 'ProductHive'}
                                    </span>
                                </div>
                                <div className="text-[13px] text-white/60 leading-relaxed pl-7">
                                    <span dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
                                </div>
                            </div>
                        )}
                    </motion.div>
                ))}

                {/* Inline thinking steps */}
                {!buildDone && messages.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#DD830A] to-[#F59E0B] flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[13px] font-semibold text-white/90">ProductHive</span>
                        </div>

                        {errorMsg ? (
                            <p className="text-[13px] text-red-400/80 pl-7">{errorMsg}</p>
                        ) : (
                            <p className="text-[13px] text-[#DD830A]/80 pl-7">
                                Building your project with React, TypeScript, Tailwind CSS, Vite, and shadcn/ui...
                            </p>
                        )}

                        <div className="pl-7 space-y-1 mt-1">
                            {steps.map(step => (
                                <div key={step.id} className="flex items-center gap-2 text-[12px]">
                                    <div className="w-4 flex-shrink-0 flex justify-center">
                                        {step.status === 'done' && <Check className="w-3.5 h-3.5 text-green-400" />}
                                        {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-[#DD830A] animate-spin" />}
                                        {step.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                        {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                    </div>
                                    <span className={
                                        step.status === 'active' ? 'text-white/80 font-medium' :
                                        step.status === 'done' ? 'text-white/30 line-through' :
                                        step.status === 'error' ? 'text-red-400/70' :
                                        'text-white/25'
                                    }>
                                        {step.label}
                                        {step.status === 'active' && step.id === 'codegen' && fileProgress && (
                                            <span className="text-[#DD830A]/60 ml-1">
                                                ({fileProgress.current}/{fileProgress.total})
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* File progress indicator */}
                        {currentFileName && (
                            <div className="pl-7 mt-2">
                                <div className="flex items-center gap-2 text-[11px] text-[#DD830A]/60">
                                    <Code2 className="w-3 h-3 animate-pulse" />
                                    <span className="font-mono">{currentFileName}</span>
                                </div>
                                {fileProgress && (
                                    <div className="mt-1.5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-[#DD830A] to-[#F59E0B] rounded-full"
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${(fileProgress.current / fileProgress.total) * 100}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {isSubmitting && (
                    <div className="flex items-center gap-2 text-white/30 text-xs pl-7">
                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="px-4 pt-3 pb-5 flex-shrink-0">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                        placeholder={buildDone ? 'Ask ProductHive to modify the code...' : 'Generating code...'}
                        disabled={!buildDone}
                        className="w-full bg-white/[0.04] text-white/80 placeholder:text-white/20 rounded-xl p-3 pr-12 text-[13px] resize-none outline-none border border-white/[0.06] focus:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        rows={2}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isSubmitting || !buildDone}
                        className={`absolute bottom-3 right-3 p-1.5 rounded-full transition-all ${
                            input.trim() && !isSubmitting && buildDone
                                ? 'bg-[#DD830A] text-white hover:bg-[#F59E0B]'
                                : 'bg-white/[0.06] text-white/20 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />
                        }
                    </button>
                </form>
                <div className="flex items-center justify-between mt-2 px-1">
                    <p className="text-[10px] text-white/20">
                        Stack: React · TypeScript · Tailwind · Vite · shadcn/ui · Supabase
                    </p>
                    {fileProgress && !buildDone && (
                        <p className="text-[10px] text-[#DD830A]/40">
                            {fileProgress.current}/{fileProgress.total} files
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFollowUpReply(input: string): string {
    if (input.toLowerCase().includes('add')) return 'I can add that component. Describe the specific functionality and I\'ll generate the code.';
    if (input.toLowerCase().includes('change') || input.toLowerCase().includes('modify')) return 'I\'ll modify the relevant files. Use the Code panel to review the current files and tell me exactly what to change.';
    if (input.toLowerCase().includes('deploy')) return 'To deploy, click the **Publish** button in the top bar. This will create a live URL for your project.';
    return 'I can help with that! Describe your changes and I\'ll update the relevant files in your project.';
}

function formatText(text: string): string {
    if (!text) return '';
    let html = text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-white/[0.08] px-1 py-0.5 rounded text-[12px] font-mono text-[#DD830A]/90">$1</code>');

    const lines = html.split('\n');
    return lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div class="h-2"></div>';
        if (trimmed.startsWith('- ')) return `<div class="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-white/40 mb-0.5">${trimmed.slice(2)}</div>`;
        return `<div class="mb-0.5">${trimmed}</div>`;
    }).join('');
}
