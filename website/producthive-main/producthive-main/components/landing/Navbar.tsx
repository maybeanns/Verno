'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, X, BookOpen, MessageSquare, Lightbulb, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';

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
        <div className="absolute top-0 -left-[20px] w-[20px] h-[20px] overflow-hidden" style={{ color }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0 H20 V20 C20 9 11 0 0 0 Z" fill="currentColor" />
            </svg>
        </div>
    );
}

function ConcaveRight({ color }: { color: string }) {
    return (
        <div className="absolute top-0 -right-[20px] w-[20px] h-[20px] overflow-hidden" style={{ color }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0 H0 V20 C0 9 9 0 20 0 Z" fill="currentColor" />
            </svg>
        </div>
    );
}

export default function Navbar() {
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const { user, loading, configured, signOut } = useAuth();
    const pathname = usePathname();

    // Don't render the global navbar on workspace pages — it has its own header
    if (pathname?.startsWith('/workspace')) return null;

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
                        {!configured || loading ? (
                            <Link href="/profile" className="text-[13px] font-display font-medium text-white/70 hover:text-white transition-colors tracking-tight">Profile</Link>
                        ) : user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsAccountOpen(v => !v)}
                                    className="flex items-center gap-1.5 text-[13px] font-display font-medium text-white/70 hover:text-white transition-colors tracking-tight"
                                >
                                    <span className="w-5 h-5 rounded-full bg-[#DD830A] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                                        {(user.email ?? '?').charAt(0).toUpperCase()}
                                    </span>
                                    <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {isAccountOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                            transition={{ duration: 0.12 }}
                                            className="absolute right-0 top-[calc(100%+10px)] w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
                                        >
                                            <div className="px-3 py-2.5 border-b border-border">
                                                <p className="text-[11px] text-muted-foreground">Signed in as</p>
                                                <p className="text-[12px] text-foreground truncate">{user.email}</p>
                                            </div>
                                            <Link
                                                href="/profile"
                                                onClick={() => setIsAccountOpen(false)}
                                                className="block px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                            >
                                                Profile &amp; API keys
                                            </Link>
                                            <button
                                                onClick={() => { setIsAccountOpen(false); void signOut(); }}
                                                className="w-full text-left px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                            >
                                                Sign out
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <button onClick={() => setIsAuthOpen(true)} className="text-[13px] font-display font-medium text-white/70 hover:text-white transition-colors tracking-tight">Sign in</button>
                        )}
                    </div>
                </motion.div>
            </nav>

            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

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
