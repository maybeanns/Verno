'use client';

import HoneycombBackground from '@/components/landing/HoneycombBackground';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-background relative overflow-x-hidden flex flex-col items-center">
            <HoneycombBackground />
            <div className="fixed inset-0 bg-gradient-mesh opacity-40 pointer-events-none" />
            <div className="fixed inset-0 bg-gradient-radial from-transparent via-background/50 to-background pointer-events-none" />

            <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-32 pb-20">
                <div className="text-center mb-16">
                    <motion.h1 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
                    >
                        Simple, transparent pricing
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-muted-foreground max-w-2xl mx-auto"
                    >
                        Choose the plan that fits your team's needs. Scale your product development with AI.
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Free Tier */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm flex flex-col"
                    >
                        <h3 className="text-2xl font-semibold text-foreground mb-2">Starter</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-foreground">$0</span>
                            <span className="text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">Perfect for individuals and small projects exploring AI-driven SDLC.</p>
                        
                        <div className="space-y-4 mb-8 flex-1">
                            {['5 PRD generations per month', 'Basic AI models (e.g. Llama 3)', 'Standard response times', 'Community support'].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-foreground">
                                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                        
                        <button className="w-full py-3 px-4 rounded-xl font-medium border border-border hover:bg-muted transition-colors">
                            Get Started
                        </button>
                    </motion.div>

                    {/* Pro Tier */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="relative p-8 rounded-2xl border border-primary/50 bg-primary/5 backdrop-blur-sm flex flex-col"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                            Most Popular
                        </div>
                        <h3 className="text-2xl font-semibold text-foreground mb-2">Pro</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-foreground">$29</span>
                            <span className="text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">For professionals who need more power and advanced AI models.</p>
                        
                        <div className="space-y-4 mb-8 flex-1">
                            {['Unlimited PRD generations', 'Premium models (GPT-4o, Claude 3.5)', 'Priority generation speed', 'Export to Jira & GitHub', 'Email support'].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-foreground">
                                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                        
                        <button className="w-full py-3 px-4 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                            Upgrade to Pro
                        </button>
                    </motion.div>

                    {/* Enterprise Tier */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm flex flex-col"
                    >
                        <h3 className="text-2xl font-semibold text-foreground mb-2">Enterprise</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-foreground">Custom</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">For teams that need custom integrations and dedicated support.</p>
                        
                        <div className="space-y-4 mb-8 flex-1">
                            {['Everything in Pro', 'Custom AI agent personas', 'SSO & SAML authentication', 'Dedicated account manager', '24/7 priority support', 'Custom billing & invoicing'].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-foreground">
                                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                        
                        <button className="w-full py-3 px-4 rounded-xl font-medium border border-border hover:bg-muted transition-colors">
                            Contact Sales
                        </button>
                    </motion.div>
                </div>
            </div>
        </main>
    );
}
