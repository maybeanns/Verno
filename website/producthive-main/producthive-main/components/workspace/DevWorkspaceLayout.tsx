'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Share2, Github, Globe, Rocket, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import DevChat from './DevChat';
import CodePanel, { type GeneratedFile } from './CodePanel';

// ── Props ────────────────────────────────────────────────────────────────────

interface DevWorkspaceLayoutProps {
    query: string;
    projectType: string;
    mode: string;
    visibility?: string;
}

// ── Main Layout ──────────────────────────────────────────────────────────────

export default function DevWorkspaceLayout({
    query,
    projectType,
    mode,
    visibility,
}: DevWorkspaceLayoutProps) {
    const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingFile, setStreamingFile] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('my-project');
    const [showShareMenu, setShowShareMenu] = useState(false);

    const handleFilesGenerated = useCallback((files: GeneratedFile[]) => {
        setGeneratedFiles(files);
    }, []);

    const handleFileStreaming = useCallback((path: string | null) => {
        setStreamingFile(path);
    }, []);

    const handleGeneratingChange = useCallback((generating: boolean) => {
        setIsGenerating(generating);
    }, []);

    const handleProjectNameChange = useCallback((name: string) => {
        setProjectName(name);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-[#0E0E10] overflow-hidden">
            {/* ── Top Bar ──────────────────────────────────────────────── */}
            <header className="h-11 flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#18181B] flex-shrink-0 z-50">
                {/* Left: Logo + Project Name */}
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
                        {projectName}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono truncate max-w-[180px] hidden sm:block">
                        {query.slice(0, 30)}{query.length > 30 ? '…' : ''}
                    </span>
                </div>

                {/* Center: Build indicator */}
                <div className="flex items-center gap-2">
                    {isGenerating ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DD830A]/10 border border-[#DD830A]/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#DD830A] animate-pulse" />
                            <span className="text-[11px] text-[#DD830A] font-medium">Building...</span>
                        </div>
                    ) : generatedFiles.length > 0 ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-[11px] text-green-400 font-medium">
                                {generatedFiles.length} files
                            </span>
                        </div>
                    ) : null}
                </div>

                {/* Right: Share + Publish */}
                <div className="flex items-center gap-2">
                    {/* Stack badge */}
                    <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06]">{projectType}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#DD830A]/10 text-[#DD830A] border border-[#DD830A]/20">{mode}</span>
                    </div>

                    {/* Share / GitHub button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowShareMenu(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
                        >
                            <Share2 className="w-3 h-3" />
                            Share
                            <ChevronDown className={`w-3 h-3 transition-transform ${showShareMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showShareMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="absolute right-0 top-full mt-1 w-52 bg-[#1E1E24] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors">
                                    <Globe className="w-3.5 h-3.5" />
                                    Copy preview link
                                </button>
                                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors">
                                    <Github className="w-3.5 h-3.5" />
                                    Push to GitHub
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* Publish button */}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#DD830A] to-[#F59E0B] text-white hover:opacity-90 transition-opacity shadow-lg shadow-[#DD830A]/20">
                        <Rocket className="w-3 h-3" />
                        Publish
                    </button>
                </div>
            </header>

            {/* ── Split Panels ─────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Chat / Code Generation */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-[380px] min-w-[320px] max-w-[480px] border-r border-white/[0.06] flex flex-col bg-[#0E0E10]"
                >
                    <DevChat
                        query={query}
                        projectType={projectType}
                        onFilesGenerated={handleFilesGenerated}
                        onFileStreaming={handleFileStreaming}
                        onGeneratingChange={handleGeneratingChange}
                        onProjectNameChange={handleProjectNameChange}
                    />
                </motion.div>

                {/* Right: Code Panel */}
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex-1 flex flex-col bg-[#15151A]"
                >
                    <CodePanel
                        files={generatedFiles}
                        isGenerating={isGenerating}
                        streamingFile={streamingFile}
                        projectName={projectName}
                    />
                </motion.div>
            </div>
        </div>
    );
}
