/**
 * ArbitratorAgent — the debate moderator.
 *
 * Listens on the AgentEventBus for all agent proposals and reviews.
 * Tracks proposal votes. When 2/3 of agents agree on a proposal, it
 * emits a 'agent:vote:resolved' event and synthesizes a consensus summary
 * via the LLM.
 *
 * Replaces the hard-coded PM-convergence step in DebateOrchestrator.
 * The DebateOrchestrator can inject an ArbitratorAgent to delegate
 * consensus detection and synthesis.
 *
 * Design choices:
 *   - Simple majority threshold (configurable)
 *   - Keeps its own transcript of proposals for LLM synthesis
 *   - Does not participate in debate as an agent itself
 */

import { LLMService } from '../../services/llm';
import {
  AgentEventBus,
  AgentProposalEvent,
  AgentReviewEvent,
  AgentVoteResolvedEvent,
  ConsensusReachedEvent,
} from './AgentEventBus';

export interface ArbitratorConfig {
  totalAgents: number;
  consensusThreshold?: number; // 0..1, default 0.67 (2/3 majority)
  maxRounds?: number;
}

export interface ConsensusResult {
  reached: boolean;
  round: number;
  summary: string;
  transcript: AgentProposalEvent[];
}

export class ArbitratorAgent {
  private readonly transcript: AgentProposalEvent[] = [];
  private readonly reviews: AgentReviewEvent[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private readonly pendingPromises: Promise<any>[] = [];
  private readonly threshold: number;
  private isActive = false;

  constructor(
    private readonly bus: AgentEventBus,
    private readonly llmService: LLMService,
    private readonly config: ArbitratorConfig,
    private readonly logger: any,
  ) {
    this.threshold = config.consensusThreshold ?? 0.67;
  }

  /** Start listening on the bus. Call before the debate begins. */
  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.transcript.length = 0;
    this.reviews.length = 0;
    this.pendingPromises.length = 0;

    this.unsubscribers.push(
      this.bus.subscribe<AgentProposalEvent>('agent:proposal', (event) => {
        this.transcript.push(event);
        this.logger.info(`[ArbitratorAgent] Received proposal from ${event.agentId} (round ${event.round})`);
        
        if (event.round >= 2) {
          const promise = (async () => {
            try {
              const sentiment = await this.classifySentiment(event.content);
              const review: AgentReviewEvent = {
                type: 'agent:review',
                agentId: event.agentId,
                targetAgentId: 'consensus',
                round: event.round,
                content: event.content,
                sentiment,
                timestamp: Date.now(),
              };
              this.reviews.push(review);
              this.bus.publish(review);
              this.logger.info(`[ArbitratorAgent] Classified sentiment for ${event.agentId}: ${sentiment}`);
            } catch (err) {
              this.logger.error(`[ArbitratorAgent] Failed to classify sentiment for ${event.agentId}`, err as Error);
            }
          })();
          this.pendingPromises.push(promise);
        }
      }),
    );

    this.unsubscribers.push(
      this.bus.subscribe<AgentReviewEvent>('agent:review', (event) => {
        this.reviews.push(event);
      }),
    );
  }

  private async classifySentiment(content: string): Promise<'agree' | 'disagree' | 'neutral'> {
    const prompt = `Analyze the following agent response from a debate. Determine if the agent is expressing agreement/consensus with the overall direction, disagreeing/objecting, or remaining neutral.

Response: "${content}"

Reply with exactly one word: "agree", "disagree", or "neutral".`;

    try {
      const result = await this.llmService.generateText(prompt);
      const clean = result.trim().toLowerCase();
      if (clean.includes('agree')) return 'agree';
      if (clean.includes('disagree')) return 'disagree';
      return 'neutral';
    } catch (err) {
      this.logger.error('[ArbitratorAgent] Sentiment classification failed, defaulting to neutral', err as Error);
      return 'neutral';
    }
  }

  /** Wait for all pending background sentiment analysis tasks to complete. */
  public async awaitPendingTasks(): Promise<void> {
    await Promise.all(this.pendingPromises);
    this.pendingPromises.length = 0;
  }

  /** Stop listening. Call after the debate ends. */
  public stop(): void {
    this.unsubscribers.forEach(u => u());
    this.unsubscribers.length = 0;
    this.pendingPromises.length = 0;
    this.isActive = false;
  }

  /**
   * Check if consensus has been reached based on sentiment of review events.
   * Returns true if ≥ threshold fraction of reviews are 'agree'.
   */
  public hasConsensus(): boolean {
    if (this.reviews.length === 0) return false;
    const agrees = this.reviews.filter(r => r.sentiment === 'agree').length;
    return agrees / this.reviews.length >= this.threshold;
  }

  /**
   * Synthesize a consensus summary from the full debate transcript.
   * This replaces the hardcoded PM-convergence prompt in DebateOrchestrator.
   */
  public async synthesize(topic: string): Promise<ConsensusResult> {
    if (this.transcript.length === 0) {
      return { reached: false, round: 0, summary: '', transcript: [] };
    }

    const lastRound = Math.max(...this.transcript.map(p => p.round));
    const transcriptText = this.transcript
      .map(p => `[${p.agentId.toUpperCase()}] (Round ${p.round}): ${p.content}`)
      .join('\n\n');

    const prompt = `You are the Arbitrator who has chaired a multi-agent SDLC debate.

Topic: "${topic}"

Full Debate Transcript (${this.transcript.length} contributions from ${this.config.totalAgents} agents over ${lastRound} round(s)):
${transcriptText}

Your task:
1. Identify the key areas of agreement across all agents.
2. Note any unresolved tensions or trade-offs.
3. Synthesize a single, authoritative executive consensus (200–300 words) that resolves disagreements and provides clear direction.
4. Include any security and compliance concerns raised.

Respond with the consensus text only — no preamble, no headers.`;

    this.logger.info('[ArbitratorAgent] Synthesizing consensus...');
    const summary = await this.llmService.generateText(prompt);

    const resolved: AgentVoteResolvedEvent = {
      type: 'agent:vote:resolved',
      proposalId: `consensus-${topic.slice(0, 30)}`,
      outcome: 'approved',
      approveCount: this.reviews.filter(r => r.sentiment === 'agree').length,
      rejectCount: this.reviews.filter(r => r.sentiment === 'disagree').length,
      timestamp: Date.now(),
    };
    this.bus.publish(resolved);

    const consensusEvent: ConsensusReachedEvent = {
      type: 'debate:consensus',
      topic,
      summary: summary.trim(),
      round: lastRound,
      timestamp: Date.now(),
    };
    this.bus.publish(consensusEvent);

    this.logger.info('[ArbitratorAgent] Consensus published to bus.');
    return {
      reached: true,
      round: lastRound,
      summary: summary.trim(),
      transcript: [...this.transcript],
    };
  }

  /** Full transcript of proposals seen so far. */
  public getTranscript(): AgentProposalEvent[] {
    return [...this.transcript];
  }
}
