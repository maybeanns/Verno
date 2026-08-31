/**
 * WorkflowEngine — simple sequential step executor (backward-compatible).
 *
 * For durable, checkpoint-resumable execution of the full SDLC pipeline,
 * use DurableWorkflowEngine instead.
 */

import { IWorkflow } from '../../types';
import { AgentRegistry } from '../../agents';

// Re-export the new durable engine so callers can import from one place
export { DurableWorkflowEngine } from './DurableWorkflowEngine';
export { CheckpointStore } from './CheckpointStore';

export class WorkflowEngine {
  constructor(private agentRegistry: AgentRegistry) {}

  async executeWorkflow(workflow: IWorkflow): Promise<string[]> {
    const results: string[] = [];

    for (const step of workflow.steps) {
      const agent = this.agentRegistry.get(step.agentName);
      if (!agent) {
        throw new Error(`Agent '${step.agentName}' not found in registry`);
      }

      const result = await agent.execute(workflow.context);
      results.push(result);
    }

    return results;
  }
}
