'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CodeEditorProps {
    filePath: string;
    content: string;
    language: string;
    isStreaming?: boolean;
}

// ── Syntax highlighting (lightweight, no heavy deps) ────────────────────────

const TOKEN_COLORS: Record<string, string> = {
    keyword: '#C678DD',      // purple
    string: '#98C379',       // green
    number: '#D19A66',       // orange
    comment: '#5C6370',      // gray
    type: '#E5C07B',         // yellow
    function: '#61AFEF',     // blue
    operator: '#56B6C2',     // cyan
    tag: '#E06C75',          // red (JSX tags)
    attribute: '#D19A66',    // orange (JSX attributes)
    punctuation: '#ABB2BF',  // light gray
    default: '#ABB2BF',      // light gray
};

function highlightLine(line: string, language: string): string {
    if (!line) return '';

    // Simple regex-based tokenizer for common patterns
    let html = escapeHtml(line);

    // Comments
    html = html.replace(/(\/\/.*$)/gm, `<span style="color:${TOKEN_COLORS.comment}">$1</span>`);
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color:${TOKEN_COLORS.comment}">$1</span>`);

    // Strings
    html = html.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;|`[^`]*?`)/g, `<span style="color:${TOKEN_COLORS.string}">$1</span>`);

    // JSX tags
    if (language === 'tsx' || language === 'jsx') {
        html = html.replace(/(&lt;\/?)([\w.]+)/g, `<span style="color:${TOKEN_COLORS.punctuation}">$1</span><span style="color:${TOKEN_COLORS.tag}">$2</span>`);
        html = html.replace(/(\/&gt;|&gt;)/g, `<span style="color:${TOKEN_COLORS.punctuation}">$1</span>`);
    }

    // Keywords
    const keywords = ['import', 'from', 'export', 'default', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'super', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'as', 'readonly', 'private', 'public', 'protected', 'static', 'implements', 'abstract'];
    for (const kw of keywords) {
        const regex = new RegExp(`\\b(${kw})\\b`, 'g');
        html = html.replace(regex, `<span style="color:${TOKEN_COLORS.keyword}">$1</span>`);
    }

    // Types (capitalized words in type positions)
    html = html.replace(/\b([A-Z][A-Za-z0-9]+)(?=[\s<({])/g, `<span style="color:${TOKEN_COLORS.type}">$1</span>`);

    // Numbers
    html = html.replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${TOKEN_COLORS.number}">$1</span>`);

    // JSON
    if (language === 'json') {
        html = escapeHtml(line);
        html = html.replace(/(&quot;[^&]*?&quot;)\s*:/g, `<span style="color:${TOKEN_COLORS.tag}">$1</span>:`);
        html = html.replace(/:\s*(&quot;[^&]*?&quot;)/g, `: <span style="color:${TOKEN_COLORS.string}">$1</span>`);
        html = html.replace(/:\s*(\d+\.?\d*)/g, `: <span style="color:${TOKEN_COLORS.number}">$1</span>`);
        html = html.replace(/:\s*(true|false|null)\b/g, `: <span style="color:${TOKEN_COLORS.keyword}">$1</span>`);
    }

    return html;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CodeEditor({ filePath, content, language, isStreaming }: CodeEditorProps) {
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLPreElement>(null);

    const lines = useMemo(() => content.split('\n'), [content]);

    // Auto-scroll during streaming
    useEffect(() => {
        if (isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [content, isStreaming]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    }, [content]);

    const handleDownload = useCallback(() => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop() || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [content, filePath]);

    const fileName = filePath.split('/').pop() || filePath;

    return (
        <div className="flex flex-col h-full bg-[#1E1E2E]">
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#1A1A2E] flex-shrink-0">
                <div className="flex items-center">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#1E1E2E] border-r border-white/[0.06] text-[12px] text-white/70">
                        <span className="w-2 h-2 rounded-full bg-[#DD830A]" />
                        <span className="font-mono">{fileName}</span>
                        {isStreaming && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-0.5 pr-2">
                    <button
                        onClick={handleCopy}
                        title="Copy code"
                        className="p-1.5 rounded text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={handleDownload}
                        title="Download file"
                        className="p-1.5 rounded text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Code area */}
            <pre
                ref={scrollRef}
                className="flex-1 overflow-auto custom-scrollbar text-[13px] leading-[1.6] font-mono"
            >
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                <td className="text-right pr-4 pl-4 py-0 select-none text-white/15 text-[12px] w-[1%] whitespace-nowrap sticky left-0 bg-[#1E1E2E]">
                                    {i + 1}
                                </td>
                                <td className="pr-8 py-0 whitespace-pre">
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: highlightLine(line, language) || '&nbsp;',
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </pre>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.06] text-[10px] text-white/20 flex-shrink-0 bg-[#1A1A2E]">
                <div className="flex items-center gap-3">
                    <span>{language}</span>
                    <span>{lines.length} lines</span>
                </div>
                <span>{(new Blob([content]).size / 1024).toFixed(1)} KB</span>
            </div>
        </div>
    );
}
