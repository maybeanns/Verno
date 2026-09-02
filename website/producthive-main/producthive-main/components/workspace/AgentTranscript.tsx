'use client';

import { Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AgentTranscriptMessage } from './WorkspaceChat';

interface AgentTranscriptProps {
    messages: AgentTranscriptMessage[];
    /** Fast Track skips the debate entirely, which is why there is nothing to show. */
    fastTrack?: boolean;
    isGenerating: boolean;
}

const TYPE_LABEL: Record<string, string> = {
    argument: 'Opening argument',
    counter: 'Counter-argument',
    consensus: 'Consensus',
};

export default function AgentTranscript({ messages, fastTrack, isGenerating }: AgentTranscriptProps) {
    if (messages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06] mb-4">
                    <Users className="w-6 h-6 text-white/20" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] text-white/30 font-medium mb-1.5">No debate in this run</p>
                <p className="text-[12px] text-white/20 max-w-xs leading-relaxed">
                    {fastTrack
                        ? 'Fast Track writes the document section by section without the 8-agent debate. Switch to SDLC mode to run the full debate.'
                        : isGenerating
                            ? 'Agent responses will appear here as the debate runs.'
                            : 'This run produced no agent messages.'}
                </p>
            </div>
        );
    }

    // Grouped by round so the two passes read as distinct rounds, matching how
    // the engine actually runs them.
    const rounds = [...new Set(messages.map(m => m.round ?? 0))].sort((a, b) => a - b);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#DD830A]" />
                    <span className="text-[13px] font-medium text-white/80">Agent Debate</span>
                </div>
                <span className="text-[10px] text-white/25">
                    {messages.length} message{messages.length === 1 ? '' : 's'}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-4 pb-10">
                    {rounds.map(round => (
                        <div key={round} className="space-y-3">
                            <div className="flex items-center gap-2.5 pt-2">
                                <span className="text-[11px] font-medium text-white/40">
                                    {round === 0 ? 'Debate' : `Round ${round}`}
                                </span>
                                <div className="flex-1 h-px bg-white/[0.06]" />
                            </div>

                            {messages
                                .filter(m => (m.round ?? 0) === round)
                                .map(msg => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={`rounded-xl border px-4 py-3 ${
                                            msg.debateType === 'consensus'
                                                ? 'border-[#DD830A]/25 bg-[#DD830A]/[0.05]'
                                                : 'border-white/[0.06] bg-white/[0.02]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: msg.agentColor }}
                                            />
                                            <span className="text-[12.5px] font-medium text-white/75">{msg.agentName}</span>
                                            {msg.debateType && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35 border border-white/[0.06]">
                                                    {TYPE_LABEL[msg.debateType] ?? msg.debateType}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-wrap">
                                            {msg.content}
                                        </p>
                                    </motion.div>
                                ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
