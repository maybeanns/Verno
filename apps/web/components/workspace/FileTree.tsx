'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileCode2, FileJson, FileText, Folder, FolderOpen, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    language?: string;
    children?: FileNode[];
}

interface FileTreeProps {
    files: { path: string; language: string }[];
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
}

// ── File icon mapping ────────────────────────────────────────────────────────

function getFileIcon(name: string, language?: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'tsx':
        case 'jsx':
            return <FileCode2 className="w-3.5 h-3.5 text-[#3B82F6]" />;
        case 'ts':
            return <FileCode2 className="w-3.5 h-3.5 text-[#3178C6]" />;
        case 'js':
            return <FileCode2 className="w-3.5 h-3.5 text-[#F7DF1E]" />;
        case 'json':
            return <FileJson className="w-3.5 h-3.5 text-[#F59E0B]" />;
        case 'css':
            return <FileCode2 className="w-3.5 h-3.5 text-[#38BDF8]" />;
        case 'md':
            return <FileText className="w-3.5 h-3.5 text-white/40" />;
        case 'toml':
        case 'yaml':
        case 'yml':
            return <FileText className="w-3.5 h-3.5 text-[#A78BFA]" />;
        default:
            return <FileText className="w-3.5 h-3.5 text-white/30" />;
    }
}

// ── Build tree from flat paths ───────────────────────────────────────────────

function buildTree(files: { path: string; language: string }[]): FileNode[] {
    const root: FileNode[] = [];

    for (const file of files) {
        const parts = file.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const existing = current.find(n => n.name === part);

            if (existing) {
                if (!isLast && existing.children) {
                    current = existing.children;
                }
            } else {
                const node: FileNode = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    type: isLast ? 'file' : 'directory',
                    language: isLast ? file.language : undefined,
                    children: isLast ? undefined : [],
                };
                current.push(node);
                if (!isLast && node.children) {
                    current = node.children;
                }
            }
        }
    }

    // Sort: directories first, then files alphabetically
    function sortNodes(nodes: FileNode[]) {
        nodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        for (const node of nodes) {
            if (node.children) sortNodes(node.children);
        }
    }
    sortNodes(root);
    return root;
}

// ── Tree Node Component ──────────────────────────────────────────────────────

function TreeNode({
    node,
    depth,
    selectedFile,
    onSelectFile,
    expandedDirs,
    toggleDir,
}: {
    node: FileNode;
    depth: number;
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
    expandedDirs: Set<string>;
    toggleDir: (path: string) => void;
}) {
    const isDir = node.type === 'directory';
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
        <>
            <button
                onClick={() => isDir ? toggleDir(node.path) : onSelectFile(node.path)}
                className={`w-full flex items-center gap-1.5 px-2 py-[5px] text-[12px] transition-colors rounded-[4px] group
                    ${isSelected
                        ? 'bg-[#DD830A]/15 text-[#F59E0B]'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                    }`}
                style={{ paddingLeft: `${8 + depth * 14}px` }}
            >
                {isDir ? (
                    <>
                        {isExpanded
                            ? <ChevronDown className="w-3 h-3 text-white/30 flex-shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" />
                        }
                        {isExpanded
                            ? <FolderOpen className="w-3.5 h-3.5 text-[#DD830A]/70 flex-shrink-0" />
                            : <Folder className="w-3.5 h-3.5 text-[#DD830A]/50 flex-shrink-0" />
                        }
                    </>
                ) : (
                    <>
                        <span className="w-3 flex-shrink-0" />
                        {getFileIcon(node.name, node.language)}
                    </>
                )}
                <span className="truncate font-mono">{node.name}</span>
            </button>

            <AnimatePresence>
                {isDir && isExpanded && node.children && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        {node.children.map(child => (
                            <TreeNode
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                selectedFile={selectedFile}
                                onSelectFile={onSelectFile}
                                expandedDirs={expandedDirs}
                                toggleDir={toggleDir}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ── Main FileTree Component ──────────────────────────────────────────────────

export default function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
        // Auto-expand src and top-level dirs
        const dirs = new Set<string>();
        for (const f of files) {
            const parts = f.path.split('/');
            if (parts.length > 1) {
                dirs.add(parts[0]);
                if (parts[0] === 'src' && parts.length > 2) {
                    dirs.add(parts.slice(0, 2).join('/'));
                }
            }
        }
        return dirs;
    });

    const tree = useMemo(() => buildTree(files), [files]);

    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return tree;
        const q = searchQuery.toLowerCase();
        function filterNodes(nodes: FileNode[]): FileNode[] {
            return nodes.reduce<FileNode[]>((acc, node) => {
                if (node.name.toLowerCase().includes(q)) {
                    acc.push(node);
                } else if (node.children) {
                    const filtered = filterNodes(node.children);
                    if (filtered.length > 0) {
                        acc.push({ ...node, children: filtered });
                    }
                }
                return acc;
            }, []);
        }
        return filterNodes(tree);
    }, [tree, searchQuery]);

    const toggleDir = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="px-2 pt-2 pb-1">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search code"
                        className="w-full bg-white/[0.04] text-white/70 placeholder:text-white/20 rounded-md pl-7 pr-2 py-1.5 text-[11px] outline-none border border-white/[0.06] focus:border-white/[0.12] transition-colors font-mono"
                    />
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-1">
                {filteredTree.length === 0 ? (
                    <p className="text-[11px] text-white/20 text-center py-4">No files yet</p>
                ) : (
                    filteredTree.map(node => (
                        <TreeNode
                            key={node.path}
                            node={node}
                            depth={0}
                            selectedFile={selectedFile}
                            onSelectFile={onSelectFile}
                            expandedDirs={expandedDirs}
                            toggleDir={toggleDir}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
