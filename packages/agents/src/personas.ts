import type { Persona } from './types';

/**
 * The canonical debate panel.
 *
 * These definitions previously existed twice — once in the extension's
 * DebateOrchestrator and once in the web app's /api/debate route — and had
 * drifted apart. The extension's copy had also accumulated instructions from a
 * specific example project (named security-scanner competitors, a rule about
 * Vite) which leaked into every unrelated debate. This is the merged, generic
 * version: the extension's depth without the contamination.
 */
export const PERSONAS: Persona[] = [
    {
        id: 'analyst',
        title: 'Business Analyst',
        focus:
            'Business requirements, KPIs, and user value. Define pricing tiers and ' +
            'free-tier limits where relevant, outline launch and go-to-market strategy, ' +
            'and analyse the competitive landscape for this specific product.',
    },
    {
        id: 'architect',
        title: 'System Architect',
        focus:
            'Backend scalability, data models, and API specification (endpoints, auth, ' +
            'schemas). Separate user-facing latency budgets from background job duration, ' +
            'require encryption in transit, and keep architectural boundaries clean.',
    },
    {
        id: 'ux',
        title: 'UX Designer',
        focus:
            'User flows and interfaces. Cover five states for each key screen — default, ' +
            'loading, empty, error, and mobile — plus WCAG 2.1 AA accessibility and ' +
            'localization.',
    },
    {
        id: 'developer',
        title: 'Developer',
        focus:
            'Code structure, technical feasibility, and component breakdown. Produce a ' +
            'dependency map covering third-party services and their licenses.',
    },
    {
        id: 'pm',
        title: 'Product Manager',
        focus:
            'Scope, milestones, and prioritization. Produce a phased roadmap with ' +
            'resourcing and enumerated features, plus support SLA, uptime targets, and ' +
            'an open-questions log.',
    },
    {
        id: 'qa',
        title: 'QA Engineer',
        focus:
            'Edge cases, testability, and test plans. Hold acceptance criteria to a ' +
            'testable, quantitative standard and reject placeholders.',
    },
    {
        id: 'techwriter',
        title: 'Technical Writer',
        focus: 'Documentation, readability, and API reference completeness.',
    },
    {
        id: 'security',
        title: 'Security Engineer',
        focus:
            'OWASP Top 10 attack vectors, authentication and authorization design, ' +
            'encryption in transit, threat modeling, abuse and rate-limiting of any free ' +
            'tier, and the regulatory boundaries (GDPR, HIPAA) the product touches.',
    },
];

/** Persona lookup by id. */
export const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(
    PERSONAS.map((p) => [p.id, p]),
);

/** The role string injected into a debate prompt. */
export function personaRole(persona: Persona): string {
    return `${persona.title} (Focus on ${persona.focus})`;
}

/** Number of debate rounds before synthesis. */
export const DEBATE_ROUNDS = 3;
