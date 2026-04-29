'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, User, Sparkles, Check, AlertCircle, ChevronRight, FileCode2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadSettings } from '@/components/landing/SettingsPanel';

interface AgentInfo { name: string; color: string; }
interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'agent';
    content: string;
    agentName?: string;
    agentColor?: string;
    round?: number;
    debateType?: 'argument' | 'counter' | 'consensus';
    timestamp: Date;
}
interface ThinkingStep { id: string; label: string; status: 'pending' | 'active' | 'done' | 'error'; }
interface WorkspaceChatProps {
    query: string; projectType: string; mode: string;
    jobId?: string; model?: string; agents: AgentInfo[];
    onPRDReady: (title: string, content: string) => void;
}

const THINKING_STEPS: Omit<ThinkingStep, 'status'>[] = [
    { id: 'guard', label: 'Scanning input for safety' },
    { id: 'debate', label: 'Multi-agent debate (2 rounds, 8 agents)' },
    { id: 'consensus', label: 'PM convergence — reaching consensus' },
    { id: 'prd-gen', label: 'Generating PRD document' },
    { id: 'security-pass', label: 'Security & compliance checks' },
    { id: 'complete', label: 'Finalizing output' },
];

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

export default function WorkspaceChat({ query, projectType, mode, agents, onPRDReady }: WorkspaceChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [steps, setSteps] = useState<ThinkingStep[]>(THINKING_STEPS.map(s => ({ ...s, status: 'pending' as const })));
    const [thinkingDone, setThinkingDone] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, steps]);

    const filteredAgents = useMemo(() => {
        if (!mentionFilter) return agents;
        const lower = mentionFilter.toLowerCase();
        return agents.filter(a => a.name.toLowerCase().includes(lower));
    }, [agents, mentionFilter]);

    useEffect(() => {
        setMessages([{ id: 'init', role: 'user', content: query, timestamp: new Date() }]);
        const creds = detectProvider();
        if (!creds) {
            setErrorMsg('No API key configured. Open Settings and add a key.');
            setSteps(prev => prev.map(s => ({ ...s, status: 'error' as const })));
            setMessages(prev => [...prev, { id: 'err-key', role: 'system', content: '⚠️ No API key found. Please configure one in Settings.', timestamp: new Date() }]);
            return;
        }
        setSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
        const controller = new AbortController();
        abortRef.current = controller;
        runDebateStream(creds.provider, creds.apiKey, controller.signal, creds.model);
        return () => { controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function runDebateStream(provider: string, apiKey: string, signal: AbortSignal, model?: string) {
        try {
            const res = await fetch('/api/debate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: query, provider, apiKey, projectType, model }), signal });
            if (!res.ok) { const errText = await res.text(); throw new Error(`API error ${res.status}: ${errText}`); }
            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');
            const decoder = new TextDecoder();
            let buffer = '';
            setSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'done' : i === 1 ? 'active' : 'pending' })));
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); }
                    else if (line.startsWith('data: ') && currentEvent) {
                        try { handleSSEEvent(currentEvent, JSON.parse(line.slice(6))); } catch { }
                        currentEvent = '';
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            const friendly = parseErrorMessage(err.message);
            setErrorMsg(friendly);
            setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s));
            setMessages(prev => [...prev, { id: 'err-stream', role: 'system', content: `❌ ${friendly}`, timestamp: new Date() }]);
        }
    }

    function handleSSEEvent(event: string, data: any) {
        switch (event) {
            case 'phase': {
                const stepMap: Record<string, number> = { debate: 1, consensus: 2, 'prd-gen': 3, 'security-pass': 4, complete: 5 };
                const idx = stepMap[data.phase];
                if (idx !== undefined) setSteps(prev => prev.map((s, i) => ({ ...s, status: i < idx ? 'done' : i === idx ? 'active' : 'pending' })));
                break;
            }
            case 'round':
                setCurrentRound(data.round);
                setMessages(prev => [...prev, { id: `round-${data.round}`, role: 'system', content: `📣 Round ${data.round} of ${data.total}`, timestamp: new Date() }]);
                break;
            case 'agent-response':
                setMessages(prev => [...prev, { id: `agent-${data.agentId}-r${data.round}-${Date.now()}`, role: 'agent', agentName: data.agentName, agentColor: data.agentColor, content: data.content, round: data.round, debateType: data.type, timestamp: new Date() }]);
                break;
            case 'consensus':
                setMessages(prev => [...prev, { id: `consensus-${Date.now()}`, role: 'agent', agentName: '🤝 ' + data.agentName + ' (Consensus)', agentColor: data.agentColor, content: data.content, round: data.round, debateType: 'consensus', timestamp: new Date() }]);
                break;
            case 'prd-complete':
                onPRDReady(data.title, data.markdown);
                setThinkingDone(true);
                setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
                setMessages(prev => [...prev, { id: 'prd-done', role: 'system', content: `✅ PRD generated! ${data.sections?.length ?? 0} sections. View it in the right panel.`, timestamp: new Date() }]);
                break;
            case 'error':
                setErrorMsg(parseErrorMessage(data.message));
                setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s));
                setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', content: `❌ ${parseErrorMessage(data.message)}`, timestamp: new Date() }]);
                break;
        }
    }

    const handleInputChange = useCallback((value: string) => {
        setInput(value);
        const pos = inputRef.current?.selectionStart ?? value.length;
        const before = value.slice(0, pos);
        const at = before.match(/@(\w*)$/);
        if (at) { setShowMentions(true); setMentionFilter(at[1]); setMentionIndex(0); }
        else { setShowMentions(false); setMentionFilter(''); }
    }, []);

    const insertMention = useCallback((name: string) => {
        const pos = inputRef.current?.selectionStart ?? input.length;
        const before = input.slice(0, pos);
        const at = before.match(/@(\w*)$/);
        if (at) { setInput(`${before.slice(0, at.index)}@${name} ${input.slice(pos)}`); }
        setShowMentions(false); setMentionFilter('');
        inputRef.current?.focus();
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSubmitting) return;
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        const userInput = input.trim(); setInput(''); setIsSubmitting(true);
        const mentions = userInput.match(/@([\w\s/()]+?)(?=\s|$)/g);
        const mentioned = mentions ? mentions.map(m => m.slice(1).trim()) : [];
        setTimeout(() => {
            if (mentioned.length > 0) {
                mentioned.forEach((name, idx) => {
                    const agent = agents.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
                    setTimeout(() => {
                        setMessages(prev => [...prev, { id: `resp-${Date.now()}-${idx}`, role: 'agent', agentName: agent?.name ?? name, agentColor: agent?.color ?? '#6366F1', content: `Here's my perspective on "${userInput.slice(0, 60)}…": This aligns with consensus. Let me know if you'd like more detail.`, timestamp: new Date() }]);
                    }, (idx + 1) * 800);
                });
            } else {
                setMessages(prev => [...prev, { id: `resp-${Date.now()}`, role: 'assistant', content: getAssistantReply(userInput), timestamp: new Date() }]);
            }
            setIsSubmitting(false);
        }, 1200);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredAgents.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (filteredAgents[mentionIndex]) insertMention(filteredAgents[mentionIndex].name); }
            else if (e.key === 'Escape') setShowMentions(false);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages + inline steps */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                        {/* User bubble */}
                        {msg.role === 'user' && (
                            <div className="bg-white/[0.05] rounded-xl px-4 py-3 text-[13px] text-white/80 leading-relaxed border border-white/[0.06]">
                                {msg.content}
                            </div>
                        )}

                        {/* System message */}
                        {msg.role === 'system' && (
                            <div className="text-[12px] text-white/40 py-1">{msg.content}</div>
                        )}

                        {/* Agent / Assistant response */}
                        {(msg.role === 'agent' || msg.role === 'assistant') && (
                            <div className="space-y-2">
                                {/* Agent header */}
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: msg.agentColor ?? '#DD830A' }}>
                                        {msg.role === 'agent' ? (msg.agentName?.[0] ?? 'A') : '✦'}
                                    </div>
                                    <span className="text-[13px] font-semibold text-white/90">
                                        {msg.role === 'agent' ? msg.agentName : 'ProductHive'}
                                    </span>
                                    {msg.round && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30">
                                            {msg.debateType === 'consensus' ? 'Consensus' : `Round ${msg.round}`}
                                        </span>
                                    )}
                                </div>

                                {/* Response text */}
                                <div className="text-[13px] text-white/60 leading-relaxed pl-7">
                                    <span dangerouslySetInnerHTML={{
                                        __html: formatChatText(msg.content)
                                    }} />
                                </div>
                            </div>
                        )}
                    </motion.div>
                ))}

                {/* Inline thinking steps — rendered inside the chat like Bolt */}
                {!thinkingDone && messages.length > 0 && (
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
                                I&apos;ll generate a professional PRD using our 8-agent debate system. Let me plan and execute this.
                            </p>
                        )}

                        <div className="pl-7 space-y-1 mt-1">
                            {steps.map((step, i) => (
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
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {isSubmitting && (
                    <div className="flex items-center gap-2 text-white/30 text-xs pl-7">
                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="px-4 pt-3 pb-5 flex-shrink-0 relative">
                {/* @mention dropdown */}
                <AnimatePresence>
                    {showMentions && filteredAgents.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                            className="absolute bottom-full left-4 right-4 mb-1 bg-[#1E1E24] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
                            <div className="p-1.5 text-[10px] text-white/30 font-medium uppercase tracking-wider px-3">Mention an agent</div>
                            {filteredAgents.map((agent, idx) => (
                                <button key={agent.name} type="button" onClick={() => insertMention(agent.name)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${idx === mentionIndex ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:bg-white/[0.04]'}`}>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: agent.color }}>{agent.name[0]}</div>
                                    <span className="font-medium">{agent.name}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={inputRef} value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder={thinkingDone ? 'How can ProductHive help you today? (or @agent)' : 'Agents are debating…'}
                        disabled={!thinkingDone}
                        className="w-full bg-white/[0.04] text-white/80 placeholder:text-white/20 rounded-xl p-3 pr-12 text-[13px] resize-none outline-none border border-white/[0.06] focus:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        rows={2}
                    />
                    <button type="submit" disabled={!input.trim() || isSubmitting || !thinkingDone}
                        className={`absolute bottom-3 right-3 p-1.5 rounded-full transition-all ${input.trim() && !isSubmitting && thinkingDone ? 'bg-[#DD830A] text-white hover:bg-[#F59E0B]' : 'bg-white/[0.06] text-white/20 cursor-not-allowed'}`}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
                <p className="text-[10px] text-white/20 mt-2 px-1">
                    Type <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-[9px]">@</kbd> to mention an agent · Questions won&apos;t modify the PRD
                </p>
            </div>
        </div>
    );
}

function getAssistantReply(input: string): string {
    if (input.toLowerCase().includes('revis')) return 'I can help with revisions! Describe what changes you\'d like and I\'ll coordinate with agents.';
    if (input.toLowerCase().includes('download')) return 'Use the download button (↓) in the PRD panel on the right.';
    return 'Based on the debate consensus, the PRD covers this. Tag specific agents (@Security Engineer, @System Architect) for targeted answers.';
}

function parseErrorMessage(raw: string): string {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const p = JSON.parse(jsonMatch[0]);
            const msg = p?.error?.message || p?.message || p?.error;
            if (typeof msg === 'string') {
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('model') && lowerMsg.includes('not found')) return 'The selected AI model is unavailable. Choose a different model in Settings.';
                if (lowerMsg.includes('rate_limit') || lowerMsg.includes('rate limit')) return 'Rate limit reached. Please wait a moment and try again.';
                if (lowerMsg.includes('invalid_api_key') || lowerMsg.includes('incorrect api key')) return 'API key is invalid. Update it in Settings.';
                if (lowerMsg.includes('insufficient_quota')) return 'Your API quota has been exhausted. Please check your billing or switch providers in Settings.';
                return msg;
            }
        } catch { }
    }
    
    const lowerRaw = raw.toLowerCase();
    if (lowerRaw.includes('404')) return 'Model not found (404). Choose a different model in Settings.';
    if (lowerRaw.includes('401') || lowerRaw.includes('403')) return 'Authentication failed. Check your API key in Settings.';
    if (lowerRaw.includes('429') || lowerRaw.includes('rate limit') || lowerRaw.includes('rate_limit')) return 'Rate limit reached. Please wait a moment and try again.';
    if (raw.length > 200) return 'An unexpected error occurred. Please check your Settings and try again.';
    return raw;
}

function formatChatText(text: string): string {
    if (!text) return '';

    // First replace mentions so they are protected
    let html = text.replace(/@([\w\s/()]+?)(?=\s|[.,:]|$)/g, '<span class="text-[#DD830A] font-semibold">@$1</span>');

    // Split by lines to process headings and lists
    const lines = html.split('\n');
    let out = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (!line) {
            out.push('<div class="h-2"></div>');
            continue;
        }

        // Bold and Code
        line = line
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="bg-white/[0.08] px-1 py-0.5 rounded text-[12px] font-mono text-[#DD830A]/90">$1</code>');

        if (line.startsWith('# ')) {
            out.push(`<strong class="text-[#DD830A] text-[14px] font-bold block mt-3 mb-1">${line.slice(2)}</strong>`);
        } else if (line.startsWith('## ')) {
            out.push(`<strong class="text-white/90 text-[13px] font-bold block mt-2 mb-1">${line.slice(3)}</strong>`);
        } else if (line.startsWith('### ')) {
            out.push(`<strong class="text-white/80 text-[13px] font-semibold block mt-2 mb-1">${line.slice(4)}</strong>`);
        } else if (line.match(/^[-*]\s+/)) {
            // Unordered list
            const content = line.replace(/^[-*]\s+/, '');
            out.push(`<div class="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-white/40 mb-1">${content}</div>`);
        } else if (line.match(/^\d+\.\s+/)) {
            // Ordered list
            const content = line.replace(/^\d+\.\s+/, '');
            out.push(`<div class="pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-white/40 mb-1">${content}</div>`);
        } else {
            // Normal paragraph line
            out.push(`<div class="mb-1">${line}</div>`);
        }
    }

    return out.join('');
}
