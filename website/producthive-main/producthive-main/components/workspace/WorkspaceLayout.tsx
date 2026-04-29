'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Eye, Code2, Terminal, Share2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import WorkspaceChat from './WorkspaceChat';
import PRDViewer from './PRDViewer';
import DevWorkspaceLayout from './DevWorkspaceLayout';

// ── 8 BMAD agents (identical to extension's DebateOrchestrator) ──────────────

const DEBATE_AGENTS = [
    { name: 'Business Analyst', color: '#6366F1' },
    { name: 'System Architect', color: '#10B981' },
    { name: 'UX Designer', color: '#F59E0B' },
    { name: 'Developer', color: '#3B82F6' },
    { name: 'Product Manager', color: '#EC4899' },
    { name: 'QA Engineer', color: '#EF4444' },
    { name: 'Technical Writer', color: '#8B5CF6' },
    { name: 'Security Engineer', color: '#F97316' },
];

// ── Main Layout ──────────────────────────────────────────────────────────────

interface WorkspaceLayoutProps {
    query: string;
    projectType: string;
    mode: string;
    jobId?: string;
    model?: string;
    visibility?: string;
}

export default function WorkspaceLayout({
    query,
    projectType,
    mode,
    jobId,
    model,
    visibility,
}: WorkspaceLayoutProps) {
    // ── Route to DevWorkspaceLayout for Develop mode ──────────────────────
    if (mode === 'Develop') {
        return (
            <DevWorkspaceLayout
                query={query}
                projectType={projectType}
                mode={mode}
                visibility={visibility}
            />
        );
    }
    const [prdContent, setPrdContent] = useState<string>('');
    const [prdTitle, setPrdTitle] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(true);
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'console'>('preview');

    const agents = DEBATE_AGENTS;

    const handlePRDReady = useCallback((title: string, content: string) => {
        setPrdTitle(title);
        setPrdContent(content);
        setIsGenerating(false);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-[#0E0E10] overflow-hidden">
            {/* ── Top Bar ──────────────────────────────────────────────── */}
            <header className="h-11 flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#18181B] flex-shrink-0 z-50">
                {/* Left: Logo + Project */}
                <div className="flex items-center gap-2.5">
                    <Link
                        href="/"
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#DD830A] to-[#F59E0B] flex items-center justify-center">
                            <Hexagon className="w-3.5 h-3.5 text-white fill-white/20" strokeWidth={2.5} />
                        </div>
                    </Link>
                    <div className="w-px h-4 bg-white/10" />
                    <span className="text-[13px] text-white/50 font-medium truncate max-w-[200px]">
                        {query.slice(0, 40)}{query.length > 40 ? '…' : ''}
                    </span>
                </div>

                {/* Center: View Tabs */}
                <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                    {([
                        { id: 'preview' as const, icon: Eye, label: 'Preview' },
                        { id: 'code' as const, icon: Code2, label: 'PRD' },
                        { id: 'console' as const, icon: Terminal, label: 'Agents' },
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-white/40 hover:text-white/60'
                            }`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06]">{projectType}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#DD830A]/10 text-[#DD830A] border border-[#DD830A]/20">{mode}</span>
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all">
                        <Share2 className="w-3 h-3" />
                        Share
                    </button>
                </div>
            </header>

            {/* ── Split Panels ─────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Chat / Thinking */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-[45%] min-w-[380px] border-r border-white/[0.06] flex flex-col bg-[#0E0E10]"
                >
                    <WorkspaceChat
                        query={query}
                        projectType={projectType}
                        mode={mode}
                        jobId={jobId}
                        model={model}
                        agents={agents}
                        onPRDReady={handlePRDReady}
                    />
                </motion.div>

                {/* Right: PRD Viewer */}
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex-1 flex flex-col bg-[#15151A]"
                >
                    <PRDViewer
                        title={prdTitle}
                        content={prdContent}
                        isGenerating={isGenerating}
                        projectType={projectType}
                    />
                </motion.div>
            </div>
        </div>
    );
}
