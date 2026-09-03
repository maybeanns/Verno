/**
 * Contracts shared by the web app and the VS Code extension.
 *
 * Both surfaces run the same debate; only the transport differs (SSE in the
 * web app, an output channel in the extension). Keeping the shapes here stops
 * the two from drifting the way the persona definitions did.
 */

/** The eight roles that take part in a PRD debate. */
export type PersonaId =
    | 'analyst'
    | 'architect'
    | 'ux'
    | 'developer'
    | 'pm'
    | 'qa'
    | 'techwriter'
    | 'security';

export interface Persona {
    id: PersonaId;
    /** Human-readable title, e.g. "System Architect". */
    title: string;
    /** What this persona is told to focus on. Injected into the round prompt. */
    focus: string;
}

/** One turn in the debate. */
export interface DebateMessage {
    /** Which persona spoke. `synthesis` marks the final PRD-writing turn. */
    agentId: PersonaId | 'synthesis';
    /** 1-based round number. Synthesis uses `totalRounds + 1`. */
    round: number;
    content: string;
}
