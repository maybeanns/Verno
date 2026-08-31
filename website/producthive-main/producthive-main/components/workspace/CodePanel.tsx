'use client';

import { useState, useCallback, useMemo } from 'react';
import { Globe, FileText, Cloud, Code2, BarChart3, MoreHorizontal, Monitor, Smartphone, Tablet, ExternalLink, RefreshCw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import JSZip from 'jszip';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import SandboxPreview from './SandboxPreview';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedFile {
    path: string;
    content: string;
    language: string;
}

interface CodePanelProps {
    files: GeneratedFile[];
    isGenerating: boolean;
    streamingFile: string | null;
    projectName: string;
    onSandpackError?: (error: string) => void;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

// ── Main Component ───────────────────────────────────────────────────────────

export default function CodePanel({ files, isGenerating, streamingFile, projectName, onSandpackError }: CodePanelProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [showTree, setShowTree] = useState(true);
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const [refreshKey, setRefreshKey] = useState(0);

    const effectiveFile = useMemo(() => {
        if (streamingFile) return streamingFile;
        if (selectedFile && files.find(f => f.path === selectedFile)) return selectedFile;
        if (files.length > 0) return files[0].path;
        return null;
    }, [selectedFile, streamingFile, files]);

    const currentFile = useMemo(() => {
        return files.find(f => f.path === effectiveFile) || null;
    }, [files, effectiveFile]);

    const handleSelectFile = useCallback((path: string) => {
        setSelectedFile(path);
        setActiveTab('code');
    }, []);

    const handleDownloadAll = useCallback(() => {
        const zip = new JSZip();
        for (const f of files) {
            const cleanPath = f.path.replace(/^\/+/, '');
            zip.file(cleanPath, f.content);
        }
        zip.generateAsync({ type: 'blob' }).then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName || 'project'}-code.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }, [files, projectName]);

    const handleOpenInNewTab = useCallback(() => {
        if (files.length === 0) return;
        try {
            // Build a simple standalone HTML for new-tab viewing
            const appFile = files.find(f => f.path.includes('App.tsx') || f.path.includes('App.jsx'));
            const cssContent = files.filter(f => f.language === 'css').map(f => f.content).join('\n');
            const componentFiles = files.filter(f =>
                (f.language === 'tsx' || f.language === 'jsx') &&
                !f.path.includes('main.tsx') && !f.path.includes('main.jsx') &&
                f.path !== appFile?.path
            );
            const allCode = [
                ...componentFiles.map(f => f.content),
                appFile?.content || 'function App() { return React.createElement("div", null, "App"); }',
            ].join('\n\n');

            const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Preview</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone@7.24.5/babel.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#0a0a0a;color:#fafafa;min-height:100vh}${cssContent.replace(/`/g, '\\`')}</style>
<script>Object.assign(window,React);window.cn=(...a)=>a.filter(Boolean).join(' ');<\/script>
</head>
<body>
<div id="root">Loading...</div>
<script type="text/babel" data-type="module" data-presets="react,typescript">
${allCode.replace(/<\/script/g, '<\\/script').replace(/import .+from .+;?/g, '// [import removed]').replace(/export default /g, '').replace(/export /g, '')}

const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(React.createElement(App));
<\/script>
</body>
</html>`;
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error("Failed to build preview:", e);
        }
    }, [files]);

    // ── Empty / Generating states ────────────────────────────────────────────

    if (files.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DD830A]/[0.03] via-transparent to-transparent pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex flex-col items-center justify-center text-center space-y-4"
                >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DD830A]/20 to-[#F59E0B]/10 flex items-center justify-center border border-[#DD830A]/10">
                        {isGenerating ? (
                            <Code2 className="w-7 h-7 text-[#DD830A]/40" strokeWidth={1.5} />
                        ) : (
                            <Globe className="w-7 h-7 text-[#DD830A]/40" strokeWidth={1.5} />
                        )}
                    </div>
                    <p className="text-[13px] text-white/25 font-medium">
                        {isGenerating ? 'Planning architecture...' : 'Your code will appear here'}
                    </p>
                    {isGenerating && (
                        <div className="flex items-center justify-center gap-1.5">
                            {[0, 1, 2].map(i => (
                                <motion.div key={i} className="w-1 h-1 rounded-full bg-[#DD830A]/60"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    // ── Lovable-style toolbar icon button ────────────────────────────────────

    const ToolbarIcon = ({ icon: Icon, active, onClick, label }: {
        icon: React.ElementType; active?: boolean; onClick?: () => void; label?: string;
    }) => (
        <button
            onClick={onClick}
            title={label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${active
                ? 'bg-[#1A3A2A] text-emerald-400 border border-emerald-500/30'
                : 'text-white/35 hover:text-white/60 hover:bg-white/[0.05]'
                }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label && active && <span>{label}</span>}
        </button>
    );

    // ── Main layout ─────────────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col">
            {/* ── Lovable-style toolbar ──────────────────────────────── */}
            <div className="flex items-center justify-between px-2 border-b border-white/[0.06] bg-[#18181B] flex-shrink-0 h-11">
                {/* Left: Tab icons */}
                <div className="flex items-center gap-0.5">
                    <ToolbarIcon icon={Globe} active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} label="Preview" />
                    <ToolbarIcon icon={FileText} onClick={() => setActiveTab('code')} active={activeTab === 'code'} />
                    {/* <ToolbarIcon icon={Cloud} />
                    <ToolbarIcon icon={Code2} onClick={() => setActiveTab('code')} />
                    <ToolbarIcon icon={BarChart3} />
                    <ToolbarIcon icon={MoreHorizontal} /> */}
                </div>

                {/* Center: Viewport + URL bar (only in preview mode) */}
                {activeTab === 'preview' && (
                    <div className="flex items-center gap-2">
                        {/* Viewport switcher */}
                        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5 border border-white/[0.06]">
                            {([
                                { key: 'desktop' as const, icon: Monitor },
                                { key: 'tablet' as const, icon: Tablet },
                                { key: 'mobile' as const, icon: Smartphone },
                            ]).map(({ key, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setViewport(key)}
                                    className={`p-1 rounded transition-colors ${viewport === key ? 'bg-white/[0.08] text-white/70' : 'text-white/25 hover:text-white/50'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                </button>
                            ))}
                        </div>

                        {/* URL bar */}
                        <div className="flex items-center gap-2 bg-white/[0.04] rounded-md px-3 py-1 border border-white/[0.06] min-w-[140px]">
                            <span className="text-[12px] text-white/30 font-mono">/</span>
                        </div>

                        {/* External link + Refresh */}
                        <button onClick={handleOpenInNewTab} className="p-1.5 rounded text-white/25 hover:text-white/50 transition-colors" title="Open in new tab">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setRefreshKey(k => k + 1)}
                            className="p-1.5 rounded text-white/25 hover:text-white/50 transition-colors"
                            title="Refresh preview"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Right: Download (code mode) */}
                <div className="flex items-center gap-1.5">
                    {activeTab === 'code' && files.length > 0 && (
                        <button onClick={handleDownloadAll}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
                            <Download className="w-3 h-3" /> Download
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content area ───────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'code' ? (
                    <>
                        {showTree && (
                            <div className="w-[220px] min-w-[180px] border-r border-white/[0.06] bg-[#15151A] flex-shrink-0">
                                <FileTree
                                    files={files.map(f => ({ path: f.path, language: f.language }))}
                                    selectedFile={effectiveFile}
                                    onSelectFile={handleSelectFile}
                                />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            {currentFile ? (
                                <CodeEditor
                                    filePath={currentFile.path}
                                    content={currentFile.content}
                                    language={currentFile.language}
                                    isStreaming={streamingFile === currentFile.path}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-[12px] text-white/20">
                                    Select a file from the tree
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <SandboxPreview
                        files={files}
                        isGenerating={isGenerating}
                        viewport={viewport}
                        refreshKey={refreshKey}
                        onSandpackError={onSandpackError}
                    />
                )}
            </div>
        </div>
    );
}
