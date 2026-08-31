'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Share2, Github, Globe, Rocket, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import DevChat from './DevChat';
import CodePanel, { type GeneratedFile } from './CodePanel';
import { loadSettings } from '@/components/landing/SettingsPanel';

// ── Props ────────────────────────────────────────────────────────────────────

interface DevWorkspaceLayoutProps {
    query: string;
    projectType: string;
    mode: string;
    visibility?: string;
}

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

    // Snapshot manager & self healing
    const [snapshots, setSnapshots] = useState<GeneratedFile[][]>([]);
    const [autoHealRetries, setAutoHealRetries] = useState(0);
    const [isHealing, setIsHealing] = useState(false);
    const [healError, setHealError] = useState<string | null>(null);

    const saveSnapshot = useCallback(() => {
        setSnapshots(prev => [...prev.slice(-4), JSON.parse(JSON.stringify(generatedFiles))]);
    }, [generatedFiles]);

    const rollback = useCallback(() => {
        if (snapshots.length > 0) {
            const last = snapshots[snapshots.length - 1];
            setSnapshots(prev => prev.slice(0, -1));
            setGeneratedFiles(last);
            localStorage.setItem(`producthive-files-${query}`, JSON.stringify(last));
            return true;
        }
        return false;
    }, [snapshots, query]);

    const handleSandpackError = useCallback(async (errorStr: string) => {
        if (isHealing || isGenerating || autoHealRetries >= 3) {
            if (autoHealRetries >= 3 && !isHealing && !healError) {
                const success = rollback();
                if (success) {
                    setHealError("Self-healing failed after 3 attempts. Reverted to the last stable snapshot.");
                } else {
                    setHealError("Self-healing failed after 3 attempts. No snapshot to revert to.");
                }
                setAutoHealRetries(0);
            }
            return;
        }

        setIsHealing(true);
        setHealError(null);

        const creds = detectProvider();
        if (!creds) {
            setIsHealing(false);
            setHealError("No API key configured for self-healing.");
            return;
        }

        try {
            const res = await fetch('/api/heal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: errorStr,
                    files: generatedFiles,
                    provider: creds.provider,
                    apiKey: creds.apiKey,
                    model: creds.model
                })
            });

            if (!res.ok) {
                throw new Error("Healing API call failed");
            }

            const data = await res.json();
            if (data.success && data.files) {
                setGeneratedFiles(data.files);
                setAutoHealRetries(prev => prev + 1);
            } else {
                throw new Error(data.error || "Failed to fix error");
            }
        } catch (err: any) {
            console.error("Healing failed:", err);
            if (autoHealRetries + 1 >= 3) {
                rollback();
                setHealError("Self-healing failed. Reverted to last stable snapshot.");
                setAutoHealRetries(0);
            } else {
                setAutoHealRetries(prev => prev + 1);
            }
        } finally {
            setIsHealing(false);
        }
    }, [isHealing, isGenerating, autoHealRetries, generatedFiles, rollback, healError]);

    // State persistence
    useEffect(() => {
        const savedFiles = localStorage.getItem(`producthive-files-${query}`);
        const savedProjectName = localStorage.getItem(`producthive-project-name-${query}`);
        if (savedFiles) {
            try {
                const parsed = JSON.parse(savedFiles);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setGeneratedFiles(parsed);
                }
            } catch (e) {}
        }
        if (savedProjectName) {
            setProjectName(savedProjectName);
        }
    }, [query]);

    useEffect(() => {
        if (generatedFiles.length > 0) {
            localStorage.setItem(`producthive-files-${query}`, JSON.stringify(generatedFiles));
        }
    }, [generatedFiles, query]);

    useEffect(() => {
        localStorage.setItem(`producthive-project-name-${query}`, projectName);
    }, [projectName, query]);

    const handleFilesGenerated = useCallback((files: GeneratedFile[]) => {
        setGeneratedFiles(files);
        setAutoHealRetries(0);
        setHealError(null);
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

                {/* Center: Build / Healing indicator */}
                <div className="flex items-center gap-2">
                    {isGenerating ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DD830A]/10 border border-[#DD830A]/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#DD830A] animate-pulse" />
                            <span className="text-[11px] text-[#DD830A] font-medium">Building...</span>
                        </div>
                    ) : isHealing ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                            <span className="text-[11px] text-blue-400 font-medium">Self-Healing (Attempt {autoHealRetries + 1}/3)...</span>
                        </div>
                    ) : healError ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[11px] text-red-400 font-medium">{healError}</span>
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
                        saveSnapshot={saveSnapshot}
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
                        onSandpackError={handleSandpackError}
                    />
                </motion.div>
            </div>
        </div>
    );
}
