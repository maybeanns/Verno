/**
 * AgentEventBus — typed in-process event bus for agent-to-agent communication.
 *
 * Replaces sequential transcript appending in DebateOrchestrator with an
 * event-driven pub/sub pattern. Agents publish proposals and reviews;
 * the ArbitratorAgent listens to manage consensus.
 *
 * Uses Node.js EventEmitter under the hood — zero external dependencies.
 * All events are typed via the AgentEvent discriminated union.
 */

import { EventEmitter } from 'events';

// ── Event payload types ────────────────────────────────────────────────────────

export interface AgentProposalEvent {
  type: 'agent:proposal';
  agentId: string;
  round: number;
  topic: string;
  content: string;
  timestamp: number;
}

export interface AgentReviewEvent {
  type: 'agent:review';
  agentId: string;
  targetAgentId: string;
  round: number;
  content: string;
  sentiment: 'agree' | 'disagree' | 'neutral';
  timestamp: number;
}

export interface AgentVoteEvent {
  type: 'agent:vote';
  agentId: string;
  proposalId: string;
  vote: 'approve' | 'reject' | 'abstain';
  timestamp: number;
}

export interface AgentVoteResolvedEvent {
  type: 'agent:vote:resolved';
  proposalId: string;
  outcome: 'approved' | 'rejected';
  approveCount: number;
  rejectCount: number;
  timestamp: number;
}

export interface PipelinePhaseCompleteEvent {
  type: 'pipeline:phase-complete';
  phaseId: string;
  output: string;
  durationMs: number;
  timestamp: number;
}

export interface PipelineErrorEvent {
  type: 'pipeline:error';
  phaseId: string;
  error: string;
  retryCount: number;
  timestamp: number;
}

export interface ConsensusReachedEvent {
  type: 'debate:consensus';
  topic: string;
  summary: string;
  round: number;
  timestamp: number;
}

export type AgentEvent =
  | AgentProposalEvent
  | AgentReviewEvent
  | AgentVoteEvent
  | AgentVoteResolvedEvent
  | PipelinePhaseCompleteEvent
  | PipelineErrorEvent
  | ConsensusReachedEvent;

// ── AgentEventBus ─────────────────────────────────────────────────────────────

export type AgentEventHandler<T extends AgentEvent = AgentEvent> = (event: T) => void;

export class AgentEventBus {
  private readonly emitter = new EventEmitter();
  private readonly history: AgentEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 500) {
    this.emitter.setMaxListeners(50); // Support many simultaneous agent subscriptions
    this.maxHistory = maxHistory;
  }

  /** Publish an event to all subscribers. */
  public publish(event: AgentEvent): void {
    // Append to history before emitting so subscribers see it
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event); // Wildcard — ArbitratorAgent listens here
  }

  /** Subscribe to a specific event type. */
  public subscribe<T extends AgentEvent>(
    eventType: T['type'] | '*',
    handler: AgentEventHandler<T>,
  ): () => void {
    const listener = (e: T) => handler(e);
    this.emitter.on(eventType, listener);
    return () => this.emitter.off(eventType, listener);
  }

  /** Subscribe to the next occurrence of an event type (one-shot). */
  public once<T extends AgentEvent>(
    eventType: T['type'],
    handler: AgentEventHandler<T>,
  ): void {
    this.emitter.once(eventType, handler);
  }

  /**
   * Wait for a specific event type (Promise-based, with timeout).
   * Resolves with the event, or rejects after timeoutMs.
   */
  public waitFor<T extends AgentEvent>(
    eventType: T['type'],
    timeoutMs = 30_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.emitter.off(eventType, listener);
        reject(new Error(`AgentEventBus: timed out waiting for '${eventType}' after ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (event: T) => {
        clearTimeout(timer);
        resolve(event);
      };

      this.emitter.once(eventType, listener);
    });
  }

  /** Get all events published in this session, optionally filtered by type. */
  public getHistory(filter?: AgentEvent['type']): AgentEvent[] {
    if (!filter) return [...this.history];
    return this.history.filter(e => e.type === filter);
  }

  /** Get all proposals published by a specific agent. */
  public getProposalsByAgent(agentId: string): AgentProposalEvent[] {
    return this.history.filter(
      (e): e is AgentProposalEvent => e.type === 'agent:proposal' && e.agentId === agentId,
    );
  }

  /** Clear the event history. */
  public clearHistory(): void {
    this.history.length = 0;
  }

  /** Remove all listeners (call on dispose). */
  public dispose(): void {
    this.emitter.removeAllListeners();
    this.history.length = 0;
  }
}

/** Singleton bus — shared across all agents in one debate session. */
export const globalAgentEventBus = new AgentEventBus();
