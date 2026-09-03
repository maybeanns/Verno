'use client';

import { useState, useRef, useCallback } from 'react';
import { Copy, Check, FileText, Maximize2, Minimize2, Hexagon, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { parseMarkdownBlocks } from '@/lib/prd/markdown';
import { renderPrdPdf } from '@/lib/prd/pdf';

interface PRDViewerProps {
    title: string;
    content: string;
    isGenerating: boolean;
    projectType: string;
    /** 'preview' renders the document; 'markdown' shows the source it came from. */
    view?: 'preview' | 'markdown';
}

export default function PRDViewer({
    title,
    content,
    isGenerating,
    projectType,
    view = 'preview',
}: PRDViewerProps) {
    const [copied, setCopied] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleCopy = useCallback(async () => {
        try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
    }, [content]);

    const handleDownloadPdf = useCallback(async () => {
        setDownloadingPdf(true);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            renderPrdPdf(doc, title, content);
            doc.save(`${(title || 'prd').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
        } finally {
            setDownloadingPdf(false);
        }
    }, [content, title]);

    // Generating / empty state — branded placeholder
    if (isGenerating || !content) {
        return (
            <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DD830A]/[0.03] via-transparent to-transparent pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 flex flex-col items-center justify-center text-center space-y-4"
                >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DD830A]/20 to-[#F59E0B]/10 flex items-center justify-center border border-[#DD830A]/10">
                        <Hexagon className="w-7 h-7 text-[#DD830A]/40 fill-[#DD830A]/10" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[13px] text-white/25 font-medium">
                            {isGenerating ? 'Your PRD will appear here' : 'Your preview will appear here'}
                        </p>
                    </div>
                    {isGenerating && (
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-1 h-1 rounded-full bg-[#DD830A]/60"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>
                <div className="absolute bottom-4 flex items-center gap-6 text-[11px] text-white/15">
                    <span className="flex items-center gap-1.5 hover:text-white/25 transition-colors cursor-pointer">
                        <span className="text-sm">📖</span> Help Center
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-white/25 transition-colors cursor-pointer">
                        <span className="text-sm">💬</span> Join our Community
                    </span>
                </div>
            </div>
        );
    }

    // Rendered PRD
    return (
        <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-[200] bg-[#15151A]' : ''}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#DD830A]" />
                    <span className="text-[13px] font-medium text-white/80 truncate max-w-[300px]">{title || 'Product Requirements Document'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                        {view === 'markdown' ? 'Markdown' : 'Generated'}
                    </span>
                </div>
                <div className="flex items-center gap-0.5">
                    <button onClick={handleCopy} title="Copy Markdown" className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        title="Download PDF"
                        disabled={downloadingPdf}
                        className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setIsFullscreen(v => !v)} title={isFullscreen ? 'Exit' : 'Fullscreen'} className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* PRD Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                {view === 'markdown' ? (
                    <pre className="text-[12.5px] leading-relaxed font-mono text-white/70 whitespace-pre-wrap break-words max-w-4xl mx-auto pb-12">
                        {content}
                    </pre>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                        className="max-w-3xl mx-auto pb-12"
                    >
                        <MarkdownRenderer content={content} />
                    </motion.div>
                )}
            </div>

            {/* Bottom bar */}
            <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/20 flex-shrink-0">
                <span>{projectType} · {content.split('\n').length} lines</span>
                <span>{(new Blob([content]).size / 1024).toFixed(1)} KB</span>
            </div>
        </div>
    );
}

// ── On-screen renderer ──────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
    const blocks = parseMarkdownBlocks(content);

    return (
        <>
            {blocks.map((block, i) => {
                switch (block.kind) {
                    case 'heading': {
                        if (block.level === 1) {
                            return <h1 key={i} className="text-2xl font-semibold text-white/90 border-b border-white/[0.06] pb-3 mb-6">{block.text}</h1>;
                        }
                        if (block.level === 2) {
                            return <h2 key={i} className="text-[17px] font-semibold text-[#DD830A] mt-8 mb-4">{block.text}</h2>;
                        }
                        return <h3 key={i} className="text-[15px] font-medium text-white/70 mt-6 mb-3">{block.text}</h3>;
                    }
                    case 'paragraph':
                        return (
                            <p
                                key={i}
                                className="text-white/80 text-[14px] leading-relaxed mb-4"
                                dangerouslySetInnerHTML={{ __html: inlineFormat(block.text) }}
                            />
                        );
                    case 'blockquote':
                        return (
                            <blockquote key={i} className="border-l-2 border-[#DD830A]/40 pl-4 py-2 my-3 bg-[#DD830A]/[0.04] rounded-r-lg">
                                {block.lines.map((line, li) => (
                                    <p key={li} className="text-[13px] text-[#DD830A]/70 leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
                                ))}
                            </blockquote>
                        );
                    case 'list': {
                        const Tag = block.ordered ? 'ol' : 'ul';
                        const listClass = block.ordered
                            ? 'list-decimal list-outside ml-4 mb-5 space-y-1.5'
                            : 'list-disc list-outside ml-4 mb-5 space-y-1.5';
                        return (
                            <Tag key={i} className={listClass}>
                                {block.items.map((item, ii) => (
                                    <li key={ii} className="text-white/80 text-[14px] leading-relaxed pl-1" dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
                                ))}
                            </Tag>
                        );
                    }
                    case 'table':
                        return (
                            <div key={i} className="w-full overflow-x-auto mb-6">
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-white/[0.08]">
                                            {block.headers.map((h, hi) => (
                                                <th key={hi} className="bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold border border-white/[0.06] text-white/70">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.map((row, ri) => (
                                            <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                                                {row.map((cell, ci) => (
                                                    <td key={ci} className="px-4 py-2 text-[13px] border border-white/[0.06] text-white/60" dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    case 'rule':
                        return <hr key={i} className="border-white/[0.06] my-8" />;
                }
            })}
        </>
    );
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="text-white/90 italic">$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-white/[0.08] px-1.5 py-0.5 rounded text-[12px] font-mono text-[#DD830A]/90">$1</code>');
}
