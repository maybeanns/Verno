'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, X, BookOpen, MessageSquare, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import SettingsPanel from './SettingsPanel';

/**
 * Concave fillet corners — the 20×20 div sits OUTSIDE the tab.
 * The SVG fills the "bridge" colour in the correct quadrant so the
 * curve faces inward (toward the centre of the viewport).
 *
 * LEFT corner  (placed at -left-[20px])  → fill top-right quadrant
 * RIGHT corner (placed at -right-[20px]) → fill top-left  quadrant
 */
function ConcaveLeft({ color }: { color: string }) {
    return (
        <div className="absolute top-0 -left-[20px] w-[20px] h-[20px]" style={{ color }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0 L20 20 Q20 0 0 0 Z" fill="currentColor" />
            </svg>
        </div>
    );
}

function ConcaveRight({ color }: { color: string }) {
    return (
        <div className="absolute top-0 -right-[20px] w-[20px] h-[20px]" style={{ color }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0 L0 20 Q0 0 20 0 Z" fill="currentColor" />
            </svg>
        </div>
    );
}

export default function Navbar() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleHomeClick = (e: React.MouseEvent) => {
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
            e.preventDefault();
            window.location.reload();
        }
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-[100] flex justify-between px-10 pointer-events-none">

                {/* ── Left Tab — Brand ── */}
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="relative pointer-events-auto"
                >
                    <div className="relative bg-[#DD830A] px-5 py-2.5 rounded-b-[20px] flex items-center gap-2 text-white">
                        <ConcaveLeft color="#DD830A" />
                        <ConcaveRight color="#DD830A" />

                        <Link href="/" onClick={handleHomeClick} className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <Hexagon className="w-4 h-4 fill-white/20 flex-shrink-0" strokeWidth={2.5} />
                            <span className="font-display font-semibold tracking-tight text-sm whitespace-nowrap">ProductHive</span>
                        </Link>
                    </div>
                </motion.div>

                {/* ── Right Tab — Navigation ── */}
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
                    className="relative pointer-events-auto"
                >
                    <div className="relative bg-[#0A0A0A] px-7 py-2.5 rounded-b-[20px] flex items-center gap-7 text-white">
                        <ConcaveLeft color="#0A0A0A" />
                        <ConcaveRight color="#0A0A0A" />

                        <button onClick={() => setIsHelpOpen(true)} className="text-[13px] font-display font-medium text-white/70 hover:text-white transition-colors tracking-tight">Help</button>
                        <Link href="/pricing" className="text-[13px] font-display font-medium text-white/70 hover:text-[#FBBF24] transition-colors tracking-tight">Pricing</Link>
                        <button onClick={() => setIsSettingsOpen(true)} className="text-[13px] font-display font-medium text-white/70 hover:text-white transition-colors tracking-tight">Profile</button>
                    </div>
                </motion.div>
            </nav>

            {/* Profile / Settings Panel */}
            <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => setIsSettingsOpen(false)}
            />

            {/* Help Modal */}
            <AnimatePresence>
                {isHelpOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHelpOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                                <h3 className="font-display font-semibold text-foreground">Resource Center</h3>
                                <button
                                    onClick={() => setIsHelpOpen(false)}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="p-4 space-y-3">
                                <div className="p-4 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors cursor-pointer group">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-foreground">Documentation</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Read the full guide on how to use ProductHive SDLC pipelines.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors cursor-pointer group">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-md bg-[#DD830A]/10 text-[#DD830A] group-hover:bg-[#DD830A] group-hover:text-white transition-colors">
                                            <Lightbulb className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-foreground">Prompting Quick-Start</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Learn how to write effective prompts to generate the best PRDs.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors cursor-pointer group">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-md bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                            <MessageSquare className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-foreground">Support Chat</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Talk to our support team if you encounter any issues.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
