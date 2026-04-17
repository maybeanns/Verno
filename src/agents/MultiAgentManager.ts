/**
 * MultiAgentManager: coordinates BMAD stages and agents
 */
import { AgentRegistry } from './base/AgentRegistry';
import { LLMService } from '../services/llm';
import { FileService } from '../services/file/FileService';
import { ProgressIndicator } from '../services/progress';
import { IAgentContext } from '../types';
import { CoverageParserService } from '../services/testing/CoverageParserService';

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
    const outputs: Record<string, string> = {};

    // Default stages
    const defaultStages = ['analyst', 'architect', 'uxdesigner', 'developer', 'pm', 'qa', 'techwriter', 'quickflowdev'];
    const stages = Array.isArray(stagesOverride) && stagesOverride.length ? stagesOverride : defaultStages;

    // Initialize progress tracking
    this.progressIndicator.initialize(stages);

    for (const stage of stages) {
      const agent = this.agentRegistry.get(stage);
      if (!agent) {
        this.logger.warn(`Agent for stage ${stage} not found`);
        outputs[stage] = `Agent ${stage} missing`;
        continue;
      }

      // Start progress for this stage
      this.progressIndicator.startStage(stage, agent.name || stage);
      this.logger.info(`Running stage: ${stage}`);

      // Enrich context with previous agent outputs
      const enrichedContext = {
        ...context,
        metadata: {
          ...context.metadata,
          previousOutputs: outputs // Pass all previous outputs to this agent
        }
      };

      try {
        const result = await agent.execute(enrichedContext as any);
        outputs[stage] = result || '';
        this.logger.info(`Stage ${stage} completed successfully`);

        // Complete progress for this stage
        this.progressIndicator.completeStage();

        // Special Phase 7 Coverage hook
        if (stage === 'qa' && context.workspaceRoot) {
            const coverageParser = new CoverageParserService();
            const pct = coverageParser.getCoveragePercentage(context.workspaceRoot);
            this.logger.info(`[MultiAgentManager] Test coverage detected: ${pct}`);
            // Send this to webview via VSCode (assume it works via metadata or context)
            outputs['coverage'] = pct;
        }

        // Persist raw LLM output for debugging/devs
        try {
          if (context.workspaceRoot) {
            const dir = `${context.workspaceRoot}/.vernollm`;
            // ensure directory exists
            const fs = require('fs');
            const path = require('path');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const outPath = path.join(dir, `${stage}.txt`);
            fs.writeFileSync(outPath, outputs[stage], 'utf-8');
          }
        } catch (e) {
          this.logger.warn(`Failed to persist raw output for ${stage}: ${e}`);
        }
      } catch (err) {
        this.logger.error(`Error running stage ${stage}: ${err}`);
        outputs[stage] = `Error: ${String(err)}`;
        this.progressIndicator.error(`Stage ${stage} failed: ${err}`);
      }
    }

    // Mark pipeline as complete
    this.progressIndicator.complete();

    return outputs;
  }
}
