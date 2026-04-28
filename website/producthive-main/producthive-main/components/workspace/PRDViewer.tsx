'use client';

import { useState, useRef, useCallback } from 'react';
import { Download, Copy, Check, FileText, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PRDViewerProps {
    title: string;
    content: string;
    isGenerating: boolean;
    projectType: string;
}

export default function PRDViewer({ title, content, isGenerating, projectType }: PRDViewerProps) {
    const [copied, setCopied] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Copy to clipboard
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* fallback: do nothing */
        }
    }, [content]);

    // Download as .md
    const handleDownload = useCallback(() => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(title || 'prd').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [content, title]);

    // Generating / empty state
    if (isGenerating || !content) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-muted/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 text-center space-y-5"
                >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
                        {isGenerating
                            ? <Loader2 className="w-7 h-7 text-primary animate-spin" />
                            : <FileText className="w-7 h-7 text-muted-foreground/40" />
                        }
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {isGenerating ? 'Generating PRD…' : 'PRD Preview'}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                            {isGenerating
                                ? 'Agents are debating and synthesizing your project requirements. This will appear here shortly.'
                                : 'Your generated PRD will appear here.'
                            }
                        </p>
                    </div>
                    {isGenerating && (
                        <div className="flex items-center justify-center gap-1">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-primary"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    // Render markdown-like content
    return (
        <div className={`h-full flex flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-[200]' : ''}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                        {title || 'Product Requirements Document'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 font-medium">
                        Generated
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        title="Copy to clipboard"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleDownload}
                        title="Download as Markdown"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsFullscreen(v => !v)}
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* PRD Content */}
            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto px-8 py-6"
            >
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="max-w-3xl mx-auto prose prose-sm dark:prose-invert
                        prose-headings:font-semibold
                        prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:mb-6
                        prose-h2:text-lg prose-h2:text-primary prose-h2:mt-8 prose-h2:mb-3
                        prose-h3:text-base prose-h3:mt-5
                        prose-p:text-muted-foreground prose-p:leading-relaxed
                        prose-strong:text-foreground
                        prose-table:border-collapse
                        prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border prose-th:border-border
                        prose-td:px-3 prose-td:py-2 prose-td:text-xs prose-td:border prose-td:border-border
                        prose-li:text-muted-foreground prose-li:text-sm
                        prose-hr:border-border
                        prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                    "
                >
                    <MarkdownRenderer content={content} />
                </motion.div>
            </div>

            {/* Bottom bar */}
            <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground flex-shrink-0">
                <span>{projectType} · {content.split('\n').length} lines</span>
                <span>{(new Blob([content]).size / 1024).toFixed(1)} KB</span>
            </div>
        </div>
    );
}

/* ── Simple Markdown Renderer ─────────────────────────────────────────────── */

function MarkdownRenderer({ content }: { content: string }) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableLines: string[] = [];
    let inTable = false;
    let listItems: string[] = [];
    let inList = false;
    let listOrdered = false;

    const flushList = () => {
        if (listItems.length > 0) {
            const Tag = listOrdered ? 'ol' : 'ul';
            elements.push(
                <Tag key={`list-${elements.length}`}>
                    {listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />)}
                </Tag>
            );
            listItems = [];
            inList = false;
        }
    };

    const flushTable = () => {
        if (tableLines.length >= 2) {
            const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
            const rows = tableLines.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
            elements.push(
                <table key={`table-${elements.length}`}>
                    <thead>
                        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri}>{row.map((cell, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />)}</tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        tableLines = [];
        inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Table detection
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            if (!inTable) {
                flushList();
                inTable = true;
            }
            tableLines.push(line);
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Blank line
        if (!line.trim()) {
            flushList();
            continue;
        }

        // Headings
        if (line.startsWith('# ')) {
            flushList();
            elements.push(<h1 key={i}>{line.slice(2)}</h1>);
            continue;
        }
        if (line.startsWith('## ')) {
            flushList();
            elements.push(<h2 key={i}>{line.slice(3)}</h2>);
            continue;
        }
        if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={i}>{line.slice(4)}</h3>);
            continue;
        }

        // HR
        if (line.trim() === '---') {
            flushList();
            elements.push(<hr key={i} />);
            continue;
        }

        // List items
        const ulMatch = line.match(/^(\s*)-\s+(.+)/);
        const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
        if (ulMatch) {
            if (!inList) { inList = true; listOrdered = false; }
            listItems.push(ulMatch[2]);
            continue;
        }
        if (olMatch) {
            if (!inList) { inList = true; listOrdered = true; }
            listItems.push(olMatch[2]);
            continue;
        }

        // Normal paragraph
        flushList();
        elements.push(<p key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    }

    flushList();
    if (inTable) flushTable();

    return <>{elements}</>;
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
}
