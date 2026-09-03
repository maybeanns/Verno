/**
 * MultiAgentManager: coordinates BMAD stages and agents using a state-graph
 */
import { AgentRegistry } from './base/AgentRegistry';
import { LLMService } from '../services/llm';
import { FileService } from '../services/file/FileService';
import { ProgressIndicator } from '../services/progress';
import { IAgentContext } from '../types';
import { CoverageParserService } from '../services/testing/CoverageParserService';
import { BlackboardState } from './core/BlackboardState';
import { GraphOrchestrator } from './core/GraphOrchestrator';

export class MultiAgentManager {
  public progressIndicator: ProgressIndicator;

  constructor(
    protected logger: any,
    protected agentRegistry: AgentRegistry,
    protected llmService: LLMService,
    protected fileService: FileService
  ) {
    this.progressIndicator = new ProgressIndicator();
  }

  /**
   * Get progress indicator instance
   */
  getProgressIndicator(): ProgressIndicator {
    return this.progressIndicator;
  }

  async runPipeline(context: IAgentContext, stagesOverride?: string[]): Promise<Record<string, string>> {
    // Default stages
    const defaultStages = ['analyst', 'architect', 'uxdesigner', 'developer', 'pm', 'qa', 'techwriter', 'quickflowdev'];
    const stages = Array.isArray(stagesOverride) && stagesOverride.length ? stagesOverride : defaultStages;

    const blackboard = new BlackboardState();
    const orchestrator = new GraphOrchestrator(this.logger, this.agentRegistry, this.progressIndicator);

    // Register active nodes in the orchestrator
    for (const stage of stages) {
      const agent = this.agentRegistry.get(stage);
      if (!agent) {
        this.logger.warn(`Agent for stage ${stage} not found, skipping node registration`);
        continue;
      }

      orchestrator.registerNode({
        id: stage,
        name: agent.name || stage,
        dependencies: this.getDependenciesForStage(stage, stages),
        run: async (ctx, state) => {
          this.logger.info(`Running stage: ${stage}`);
          const result = await agent.execute(ctx);

          // QA coverage hook
          if (stage === 'qa' && ctx.workspaceRoot) {
            try {
              const coverageParser = new CoverageParserService();
              const pct = coverageParser.getCoveragePercentage(ctx.workspaceRoot);
              this.logger.info(`[MultiAgentManager] Test coverage detected: ${pct}`);
              state.setMetadata('coverage', pct);
            } catch (e) {
              this.logger.warn(`Failed to parse test coverage: ${e}`);
            }
          }

          // Persist raw LLM output for debugging/devs
          try {
            if (ctx.workspaceRoot) {
              const dir = `${ctx.workspaceRoot}/.vernollm`;
              const fs = require('fs');
              const path = require('path');
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              const outPath = path.join(dir, `${stage}.txt`);
              fs.writeFileSync(outPath, result || '', 'utf-8');
            }
          } catch (e) {
            this.logger.warn(`Failed to persist raw output for ${stage}: ${e}`);
          }

          return result || '';
        }
      });
    }

    const outputs = await orchestrator.executeGraph(context, blackboard);

    // Include coverage in outputs if present
    const coverage = blackboard.getMetadata<string>('coverage');
    if (coverage) {
      outputs['coverage'] = coverage;
    }

    return outputs;
  }

  private getDependenciesForStage(stage: string, activeStages: string[]): string[] {
    const allDeps: Record<string, string[]> = {
      analyst: [],
      architect: ['analyst'],
      uxdesigner: ['architect'],
      developer: ['architect', 'uxdesigner'],
      pm: ['analyst', 'architect'],
      qa: ['developer'],
      techwriter: ['developer'],
      quickflowdev: []
    };

    const deps = allDeps[stage] || [];
    // Only return dependencies that are actively part of this execution stages list
    return deps.filter(d => activeStages.includes(d));
  }
}

