/**
 * DurableWorkflowEngine — checkpoint-aware SDLC pipeline orchestrator.
 *
 * Wraps the existing GraphOrchestrator with durable state: each phase's
 * output is persisted to CheckpointStore immediately upon completion.
 * On re-entry with the same runId, already-completed phases are restored
 * from disk and skipped, making the pipeline resumable across VS Code restarts.
 *
 * Usage:
 *   const engine = new DurableWorkflowEngine(logger, agentRegistry, checkpointStore, progress);
 *   const outputs = await engine.run(context, runId, topic, stagesOverride);
 *
 * Resume after reload:
 *   // Provide the same runId that was used for the interrupted run
 *   const outputs = await engine.run(context, previousRunId, topic);
 */

import * as crypto from 'crypto';
import { AgentRegistry } from '../../agents/base/AgentRegistry';
import { IAgentContext } from '../../types';
import { BlackboardState } from '../../agents/core/BlackboardState';
import { GraphOrchestrator, GraphNode } from '../../agents/core/GraphOrchestrator';
import { ProgressIndicator } from '../progress';
import { CheckpointStore } from './CheckpointStore';
import { CoverageParserService } from '../testing/CoverageParserService';
import * as fs from 'fs';
import * as path from 'path';

export type RunStatus = 'running' | 'completed' | 'failed';

export interface DurableRunMeta {
  runId: string;
  topic: string;
  startedAt: number;
  status: RunStatus;
  completedPhases: string[];
}

export class DurableWorkflowEngine {
  private readonly DEFAULT_STAGES = [
    'analyst', 'architect', 'uxdesigner', 'developer',
    'pm', 'qa', 'techwriter', 'quickflowdev',
  ];

  constructor(
    private readonly logger: any,
    private readonly agentRegistry: AgentRegistry,
    private readonly checkpointStore: CheckpointStore,
    private readonly progressIndicator: ProgressIndicator = new ProgressIndicator(),
  ) {}

  /**
   * Generate a new run ID. Expose this so callers can persist it for later resume.
   */
  public static newRunId(): string {
    return crypto.randomUUID();
  }

  /**
   * Execute (or resume) the SDLC pipeline for the given runId.
   *
   * @param context       Standard agent context
   * @param runId         Unique run identifier. Pass a previous runId to resume.
   * @param topic         Human-readable description of the pipeline goal
   * @param stagesOverride Override the default stage list
   */
  public async run(
    context: IAgentContext,
    runId: string,
    topic: string,
    stagesOverride?: string[],
  ): Promise<Record<string, string>> {
    const stages = (Array.isArray(stagesOverride) && stagesOverride.length)
      ? stagesOverride
      : this.DEFAULT_STAGES;

    // Load any previously completed phases from disk
    const completedPhases = this.checkpointStore.load(runId);
    const outputs: Record<string, string> = {};

    // Pre-populate outputs with previously completed phases
    for (const [phaseId, output] of completedPhases) {
      outputs[phaseId] = output;
      this.logger.info(`[DurableWorkflowEngine] Restoring checkpoint for phase: ${phaseId}`);
    }

    const blackboard = new BlackboardState();
    const orchestrator = new GraphOrchestrator(
      this.logger,
      this.agentRegistry,
      this.progressIndicator,
    );

    // Register nodes, skipping phases that were already completed
    for (const stage of stages) {
      const agent = this.agentRegistry.get(stage);
      if (!agent) {
        this.logger.warn(`[DurableWorkflowEngine] Agent '${stage}' not found, skipping`);
        continue;
      }

      if (completedPhases.has(stage)) {
        // Register a no-op node that immediately resolves with the cached output.
        // This satisfies dependency tracking in GraphOrchestrator without re-running the agent.
        orchestrator.registerNode({
          id: stage,
          name: `${agent.name || stage} (restored)`,
          dependencies: this.getDependencies(stage, stages),
          run: async (_ctx, _state) => completedPhases.get(stage)!,
        });
        continue;
      }

      orchestrator.registerNode(this.buildNode(stage, agent, stages, runId, topic, outputs, context, blackboard));
    }

    const finalOutputs = await orchestrator.executeGraph(context, blackboard);

    // Merge restored checkpoints back in (in case of partial overlap)
    for (const [k, v] of completedPhases) {
      if (!finalOutputs[k]) finalOutputs[k] = v;
    }

    // Coverage hook
    if (context.workspaceRoot) {
      try {
        const coverage = new CoverageParserService().getCoveragePercentage(context.workspaceRoot);
        finalOutputs['coverage'] = coverage;
        blackboard.setMetadata('coverage', coverage);
      } catch { /* non-fatal */ }
    }

    // Clear checkpoint on successful completion
    this.checkpointStore.clear(runId);
    this.logger.info(`[DurableWorkflowEngine] Pipeline complete. Run ${runId} finished.`);

    return finalOutputs;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildNode(
    stage: string,
    agent: any,
    stages: string[],
    runId: string,
    topic: string,
    outputs: Record<string, string>,
    _context: IAgentContext,
    blackboard: BlackboardState,
  ): GraphNode {
    return {
      id: stage,
      name: agent.name || stage,
      dependencies: this.getDependencies(stage, stages),
      run: async (ctx: IAgentContext, state: BlackboardState) => {
        this.logger.info(`[DurableWorkflowEngine] Running phase: ${stage}`);

        const enrichedCtx: IAgentContext = {
          ...ctx,
          metadata: {
            ...ctx.metadata,
            previousOutputs: { ...outputs },
          },
        };

        const result = await agent.execute(enrichedCtx);
        const output = result || '';
        outputs[stage] = output;

        // ── Persist checkpoint immediately ───────────────────────────────────
        this.checkpointStore.save(runId, stage, output, topic);
        this.logger.info(`[DurableWorkflowEngine] Checkpoint saved for phase: ${stage}`);

        // ── Persist raw LLM output for debugging ─────────────────────────────
        if (ctx.workspaceRoot) {
          try {
            const dir = path.join(ctx.workspaceRoot, '.vernollm');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${stage}.txt`), output, 'utf-8');
          } catch { /* non-fatal */ }
        }

        return output;
      },
    };
  }

  private getDependencies(stage: string, activeStages: string[]): string[] {
    const ALL_DEPS: Record<string, string[]> = {
      analyst:      [],
      architect:    ['analyst'],
      uxdesigner:   ['architect'],
      developer:    ['architect', 'uxdesigner'],
      pm:           ['analyst', 'architect'],
      qa:           ['developer'],
      techwriter:   ['developer'],
      quickflowdev: [],
    };
    return (ALL_DEPS[stage] ?? []).filter(d => activeStages.includes(d));
  }
}
