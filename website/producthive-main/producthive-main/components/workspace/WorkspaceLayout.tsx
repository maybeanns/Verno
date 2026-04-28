'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Hexagon } from 'lucide-react';
import Link from 'next/link';
import WorkspaceChat from './WorkspaceChat';
import PRDViewer from './PRDViewer';

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
    // The PRD content — populated when generation completes or the user wants to preview
    const [prdContent, setPrdContent] = useState<string>('');
    const [prdTitle, setPrdTitle] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(true);

    const agents = DEBATE_AGENTS;

    // Called by the chat panel when a PRD is produced
    const handlePRDReady = useCallback((title: string, content: string) => {
        setPrdTitle(title);
        setPrdContent(content);
        setIsGenerating(false);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* ── Top Bar ──────────────────────────────────────────────── */}
            <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/80 backdrop-blur-md flex-shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <Hexagon className="w-4 h-4 text-[#DD830A] fill-[#DD830A]/20" strokeWidth={2.5} />
                        <span className="text-xs font-semibold tracking-tight">ProductHive</span>
                    </Link>
                    <div className="w-px h-5 bg-border mx-1" />
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted border border-border font-medium">{projectType}</span>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">{mode}</span>
                        {visibility === 'private' && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Private</span>
                        )}
                    </div>
                </div>
                <div className="text-[11px] text-muted-foreground/60">
                    {model && <span>Model: {model}</span>}
                </div>
            </header>

            {/* ── Split Panels ─────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Chat / Thinking */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-[45%] min-w-[380px] border-r border-border flex flex-col"
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
                    className="flex-1 flex flex-col"
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
