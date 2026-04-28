'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, User, Bot, Sparkles, Check, AlertCircle, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadSettings } from '@/components/landing/SettingsPanel';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface AgentInfo {
    name: string;
    color: string;
}

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

interface ThinkingStep {
    id: string;
    label: string;
    icon: string;
    status: 'pending' | 'active' | 'done' | 'error';
}

interface WorkspaceChatProps {
    query: string;
    projectType: string;
    mode: string;
    jobId?: string;
    model?: string;
    agents: AgentInfo[];
    onPRDReady: (title: string, content: string) => void;
}

/* ── Pipeline steps ───────────────────────────────────────────────────────── */

const THINKING_STEPS: Omit<ThinkingStep, 'status'>[] = [
    { id: 'guard', label: 'Scanning input for safety', icon: '🛡️' },
    { id: 'debate', label: 'Multi-agent debate (3 rounds, 8 agents)', icon: '🗣️' },
    { id: 'consensus', label: 'PM convergence — reaching consensus', icon: '🤝' },
    { id: 'prd-gen', label: 'Generating PRD document', icon: '📝' },
    { id: 'security-pass', label: 'Security & compliance checks', icon: '🔒' },
    { id: 'complete', label: 'Finalizing output', icon: '💾' },
];

/* ── Determine which LLM provider to use ──────────────────────────────────── */

function detectProvider(): { provider: string; apiKey: string; model?: string } | null {
    const settings = loadSettings();
    if (!settings.preferredModel) return null;

    if (settings.preferredModel === 'Groq' && settings.groqKey) return { provider: 'Groq', apiKey: settings.groqKey, model: settings.groqModel || 'llama-3.3-70b-versatile' };
    if (settings.preferredModel === 'OpenAI' && settings.openaiKey) return { provider: 'OpenAI', apiKey: settings.openaiKey };
    if (settings.preferredModel === 'Qwen' && settings.qwenKey) return { provider: 'Qwen', apiKey: settings.qwenKey };
    if (settings.preferredModel === 'Mistral AI' && settings.mistralKey) return { provider: 'Mistral AI', apiKey: settings.mistralKey };
    if (settings.preferredModel === 'Google' && settings.googleKey) return { provider: 'Google', apiKey: settings.googleKey };
    if (settings.preferredModel === 'Moonshot AI' && settings.moonshotKey) return { provider: 'Moonshot AI', apiKey: settings.moonshotKey };
    if (settings.preferredModel === 'MiniMax' && settings.minimaxKey) return { provider: 'MiniMax', apiKey: settings.minimaxKey };
    if (settings.preferredModel === 'DeepSeek' && settings.deepseekKey) return { provider: 'DeepSeek', apiKey: settings.deepseekKey };
    
    // Fallback logic
    if (settings.groqKey) return { provider: 'Meta', apiKey: settings.groqKey };
    if (settings.openaiKey) return { provider: 'OpenAI', apiKey: settings.openaiKey };
    if (settings.anthropicKey) return { provider: 'Anthropic', apiKey: settings.anthropicKey };
    
    return null;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function WorkspaceChat({
    query,
    projectType,
    mode,
    agents,
    onPRDReady,
}: WorkspaceChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [steps, setSteps] = useState<ThinkingStep[]>(
        THINKING_STEPS.map(s => ({ ...s, status: 'pending' as const }))
    );
    const [thinkingDone, setThinkingDone] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, steps]);

    // Filtered agents for @mention dropdown
    const filteredAgents = useMemo(() => {
        if (!mentionFilter) return agents;
        const lower = mentionFilter.toLowerCase();
        return agents.filter(a => a.name.toLowerCase().includes(lower));
    }, [agents, mentionFilter]);

    // ── Kick off the real debate on mount ────────────────────────────
    useEffect(() => {
        // Initial user message
        setMessages([{
            id: 'init',
            role: 'user',
            content: query,
            timestamp: new Date(),
        }]);

        const creds = detectProvider();
        if (!creds) {
            setErrorMsg('No API key configured. Open Settings (gear icon) and add a Groq, OpenAI, or Anthropic key.');
            setSteps(prev => prev.map(s => ({ ...s, status: 'error' as const })));
            setMessages(prev => [...prev, {
                id: 'err-key',
                role: 'system',
                content: '⚠️ No API key found. Please configure an API key in Settings and reload.',
                timestamp: new Date(),
            }]);
            return;
        }

        // Mark guard step as active immediately
        setSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));

        const controller = new AbortController();
        abortRef.current = controller;

        runDebateStream(creds.provider, creds.apiKey, controller.signal, creds.model);

        return () => { controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function runDebateStream(provider: string, apiKey: string, signal: AbortSignal, model?: string) {
        try {
            const res = await fetch('/api/debate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: query, provider, apiKey, projectType, model }),
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

            // Mark guard step done, debate active
            setSteps(prev => prev.map((s, i) => ({
                ...s,
                status: i === 0 ? 'done' : i === 1 ? 'active' : 'pending',
            })));

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
                            const data = JSON.parse(line.slice(6));
                            handleSSEEvent(currentEvent, data);
                        } catch { /* skip malformed */ }
                        currentEvent = '';
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setErrorMsg(err.message);
            setSteps(prev => prev.map(s =>
                s.status === 'active' ? { ...s, status: 'error' as const } : s
            ));
            setMessages(prev => [...prev, {
                id: 'err-stream',
                role: 'system',
                content: `❌ Error: ${err.message}`,
                timestamp: new Date(),
            }]);
        }
    }

    function handleSSEEvent(event: string, data: any) {
        switch (event) {
            case 'phase': {
                const stepMap: Record<string, number> = {
                    debate: 1, consensus: 2, 'prd-gen': 3, 'security-pass': 4, complete: 5,
                };
                const idx = stepMap[data.phase];
                if (idx !== undefined) {
                    setSteps(prev => prev.map((s, i) => ({
                        ...s,
                        status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
                    })));
                }
                break;
            }

            case 'round':
                setCurrentRound(data.round);
                setMessages(prev => [...prev, {
                    id: `round-${data.round}`,
                    role: 'system',
                    content: `📣 Round ${data.round} of ${data.total}`,
                    timestamp: new Date(),
                }]);
                break;

            case 'agent-response':
                setMessages(prev => [...prev, {
                    id: `agent-${data.agentId}-r${data.round}-${Date.now()}`,
                    role: 'agent',
                    agentName: data.agentName,
                    agentColor: data.agentColor,
                    content: data.content,
                    round: data.round,
                    debateType: data.type,
                    timestamp: new Date(),
                }]);
                break;

            case 'consensus':
                setMessages(prev => [...prev, {
                    id: `consensus-${Date.now()}`,
                    role: 'agent',
                    agentName: '🤝 ' + data.agentName + ' (Consensus)',
                    agentColor: data.agentColor,
                    content: data.content,
                    round: data.round,
                    debateType: 'consensus',
                    timestamp: new Date(),
                }]);
                break;

            case 'prd-complete':
                onPRDReady(data.title, data.markdown);
                setThinkingDone(true);
                setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
                setMessages(prev => [...prev, {
                    id: 'prd-done',
                    role: 'system',
                    content: `✅ PRD generated! ${data.sections?.length ?? 0} sections from ${data.agentCount}-agent debate over ${data.roundCount} rounds. View it in the right panel.`,
                    timestamp: new Date(),
                }]);
                break;

            case 'error':
                setErrorMsg(data.message);
                setSteps(prev => prev.map(s =>
                    s.status === 'active' ? { ...s, status: 'error' as const } : s
                ));
                setMessages(prev => [...prev, {
                    id: 'err-' + Date.now(),
                    role: 'system',
                    content: `❌ ${data.message}`,
                    timestamp: new Date(),
                }]);
                break;

            case 'done':
                // Stream finished
                break;
        }
    }

    // ── Handle @mention logic ────────────────────────────────────────
    const handleInputChange = useCallback((value: string) => {
        setInput(value);
        const cursorPos = inputRef.current?.selectionStart ?? value.length;
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);
        if (atMatch) {
            setShowMentions(true);
            setMentionFilter(atMatch[1]);
            setMentionIndex(0);
        } else {
            setShowMentions(false);
            setMentionFilter('');
        }
    }, []);

    const insertMention = useCallback((agentName: string) => {
        const cursorPos = inputRef.current?.selectionStart ?? input.length;
        const textBeforeCursor = input.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);
        if (atMatch) {
            const before = textBeforeCursor.slice(0, atMatch.index);
            const after = input.slice(cursorPos);
            setInput(`${before}@${agentName} ${after}`);
        }
        setShowMentions(false);
        setMentionFilter('');
        inputRef.current?.focus();
    }, [input]);

    // ── Submit follow-up chat message ────────────────────────────────
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

        // Detect @mentions
        const mentionMatches = userInput.match(/@([\w\s/()]+?)(?=\s|$)/g);
        const mentionedAgents = mentionMatches
            ? mentionMatches.map(m => m.slice(1).trim())
            : [];

        setTimeout(() => {
            if (mentionedAgents.length > 0) {
                mentionedAgents.forEach((name, idx) => {
                    const agent = agents.find(a =>
                        a.name.toLowerCase().includes(name.toLowerCase())
                    );
                    setTimeout(() => {
                        setMessages(prev => [...prev, {
                            id: `resp-${Date.now()}-${idx}`,
                            role: 'agent',
                            agentName: agent?.name ?? name,
                            agentColor: agent?.color ?? '#6366F1',
                            content: `Based on the PRD debate, here's my perspective on "${userInput.slice(0, 60)}…": This aligns with the consensus we reached. The key consideration from my domain is ensuring we maintain consistency with the agreed architecture while addressing your specific concern. Let me know if you'd like more detail.`,
                            timestamp: new Date(),
                        }]);
                    }, (idx + 1) * 800);
                });
            } else {
                setMessages(prev => [...prev, {
                    id: `resp-${Date.now()}`,
                    role: 'assistant',
                    content: getAssistantReply(userInput),
                    timestamp: new Date(),
                }]);
            }
            setIsSubmitting(false);
        }, 1200);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(i => Math.min(i + 1, filteredAgents.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredAgents[mentionIndex]) {
                    insertMention(filteredAgents[mentionIndex].name);
                }
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    /* ── Render ────────────────────────────────────────────────────── */
    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#DD830A] to-[#F59E0B] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Agent Debate Workspace</h2>
                        <p className="text-[10px] text-muted-foreground">
                            {thinkingDone
                                ? 'Ready — ask questions or request revisions'
                                : errorMsg
                                    ? 'Error occurred'
                                    : currentRound > 0
                                        ? `Round ${currentRound}/3 — 8 agents debating…`
                                        : 'Initializing debate…'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {agents.slice(0, 5).map((a, i) => (
                        <div
                            key={i}
                            title={a.name}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-background -ml-1 first:ml-0"
                            style={{ backgroundColor: a.color }}
                        >
                            {a.name[0]}
                        </div>
                    ))}
                    {agents.length > 5 && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground border-2 border-background -ml-1">
                            +{agents.length - 5}
                        </div>
                    )}
                </div>
            </div>

            {/* Thinking Steps */}
            {!thinkingDone && (
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex-shrink-0">
                    <div className="space-y-1.5">
                        {steps.map((step) => (
                            <div key={step.id} className="flex items-center gap-2.5 text-xs">
                                <div className="w-5 flex-shrink-0 flex justify-center">
                                    {step.status === 'done' && <Check className="w-3.5 h-3.5 text-green-500" />}
                                    {step.status === 'active' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                                    {step.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-border" />}
                                    {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                                </div>
                                <span className={step.status === 'active' ? 'text-foreground font-medium' : step.status === 'done' ? 'text-muted-foreground line-through' : step.status === 'error' ? 'text-red-400' : 'text-muted-foreground/50'}>
                                    {step.icon} {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" ref={scrollRef}>
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {/* Avatar (left side for non-user) */}
                            {msg.role !== 'user' && (
                                <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                                    style={{
                                        backgroundColor: msg.role === 'agent' ? (msg.agentColor ?? '#6366F1')
                                            : msg.role === 'system' ? '#3B82F6'
                                            : '#8B5CF6'
                                    }}
                                >
                                    {msg.role === 'agent' ? msg.agentName?.[0] ?? 'A'
                                        : msg.role === 'system' ? '⚡'
                                        : <Bot className="w-3.5 h-3.5" />}
                                </div>
                            )}

                            {/* Bubble */}
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : msg.role === 'system'
                                        ? 'bg-blue-500/10 border border-blue-500/20 text-foreground rounded-bl-sm'
                                        : msg.role === 'agent'
                                            ? 'bg-card border border-border text-foreground rounded-bl-sm'
                                            : 'bg-muted text-foreground rounded-bl-sm'
                            }`}>
                                {/* Agent name + round badge */}
                                {msg.role === 'agent' && msg.agentName && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-semibold" style={{ color: msg.agentColor }}>
                                            {msg.agentName}
                                        </span>
                                        {msg.round && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                                {msg.debateType === 'consensus' ? 'Consensus' : `Round ${msg.round}`}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <span dangerouslySetInnerHTML={{
                                    __html: msg.content.replace(
                                        /@([\w\s/()]+?)(?=\s|$)/g,
                                        '<span class="text-primary font-semibold">@$1</span>'
                                    )
                                }} />
                                <div className="text-[9px] text-muted-foreground/50 mt-1">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            {/* Avatar (right side for user) */}
                            {msg.role === 'user' && (
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <User className="w-3.5 h-3.5 text-primary" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isSubmitting && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs pl-10">
                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 border-t border-border bg-card/50 flex-shrink-0 relative">
                {/* @mention dropdown */}
                <AnimatePresence>
                    {showMentions && filteredAgents.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute bottom-full left-4 right-4 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
                        >
                            <div className="p-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-3">
                                Mention an agent
                            </div>
                            {filteredAgents.map((agent, idx) => (
                                <button
                                    key={agent.name}
                                    type="button"
                                    onClick={() => insertMention(agent.name)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                                        idx === mentionIndex ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                        style={{ backgroundColor: agent.color }}
                                    >
                                        {agent.name[0]}
                                    </div>
                                    <span className="font-medium">{agent.name}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={thinkingDone ? 'Ask a question or type @ to tag an agent…' : 'Agents are debating…'}
                        disabled={!thinkingDone}
                        className="w-full bg-muted/50 text-foreground placeholder:text-muted-foreground/50 rounded-xl p-3 pr-12 text-sm resize-none outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={2}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isSubmitting || !thinkingDone}
                        className={`absolute bottom-3 right-3 p-1.5 rounded-lg transition-all ${
                            input.trim() && !isSubmitting && thinkingDone
                                ? 'bg-primary text-primary-foreground hover:opacity-90'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 px-1">
                    Type <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">@</kbd> to mention an agent · Questions won&apos;t modify the PRD
                </p>
            </div>
        </div>
    );
}

/* ── Helper: follow-up replies ────────────────────────────────────────────── */

function getAssistantReply(input: string): string {
    if (input.toLowerCase().includes('revis')) {
        return 'I can help with revisions! Please describe what changes you\'d like to make to the PRD, and I\'ll coordinate with the relevant agents to update it.';
    }
    if (input.toLowerCase().includes('download')) {
        return 'You can download the PRD using the download button (↓) in the top-right corner of the PRD panel on the right side.';
    }
    return `Based on the multi-agent debate and PRD consensus, here's what I can tell you:\n\nThe current document covers this area in the relevant sections. You can also tag specific agents (e.g., @Security Engineer or @System Architect) for more targeted answers.\n\nWould you like me to elaborate on any specific section?`;
}
