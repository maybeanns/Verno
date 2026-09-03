import { AgentRegistry } from '../base/AgentRegistry';
import { IAgentContext } from '../../types';
import { BlackboardState, BlackboardStateData } from './BlackboardState';
import { ProgressIndicator } from '../../services/progress';

export interface GraphNode {
  id: string;
  name: string;
  dependencies: string[];
  run: (context: IAgentContext, state: BlackboardState) => Promise<string>;
}

export class GraphOrchestrator {
  private nodes: Map<string, GraphNode> = new Map();
  private progressIndicator: ProgressIndicator;

  constructor(
    protected logger: any,
    private agentRegistry: AgentRegistry,
    progressIndicator?: ProgressIndicator
  ) {
    this.progressIndicator = progressIndicator || new ProgressIndicator();
  }

  public registerNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public getProgressIndicator(): ProgressIndicator {
    return this.progressIndicator;
  }

  public async executeGraph(context: IAgentContext, blackboard: BlackboardState): Promise<Record<string, string>> {
    const outputs: Record<string, string> = {};
    const executed = new Set<string>();
    const executing = new Set<string>();

    const allNodeIds = Array.from(this.nodes.keys());
    this.progressIndicator.initialize(allNodeIds);

    this.logger.info(`Starting state-graph execution with ${allNodeIds.length} nodes.`);

    while (executed.size < this.nodes.size) {
      const runnableNodes = Array.from(this.nodes.values()).filter(node => {
        if (executed.has(node.id) || executing.has(node.id)) return false;
        return node.dependencies.every(dep => executed.has(dep));
      });

      if (runnableNodes.length === 0 && executing.size === 0) {
        // Deadlock or finished
        const unexecuted = allNodeIds.filter(id => !executed.has(id));
        if (unexecuted.length > 0) {
          throw new Error(`State Graph deadlock detected. Unexecuted nodes: ${unexecuted.join(', ')}`);
        }
        break;
      }

      if (runnableNodes.length === 0) {
        // Wait for currently executing nodes to finish (handled implicitly by Promise.all in real async, but here we run next batch)
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Execute all runnable nodes in parallel
      const batchPromises = runnableNodes.map(async node => {
        executing.add(node.id);
        this.progressIndicator.startStage(node.id, node.name);
        this.logger.info(`[GraphOrchestrator] Running node: ${node.id}`);

        try {
          // Enrich context with outputs of completed steps
          const enrichedContext: IAgentContext = {
            ...context,
            metadata: {
              ...context.metadata,
              previousOutputs: { ...outputs },
            }
          };

          const result = await node.run(enrichedContext, blackboard);
          outputs[node.id] = result;
          this.logger.info(`[GraphOrchestrator] Node ${node.id} completed successfully`);
          this.progressIndicator.completeStage();
        } catch (err) {
          this.logger.error(`[GraphOrchestrator] Node ${node.id} failed: ${err}`);
          outputs[node.id] = `Error: ${String(err)}`;
          blackboard.addIssue({
            severity: 'high',
            description: `Node ${node.id} failed`,
            context: String(err)
          });
          this.progressIndicator.error(`Node ${node.id} failed: ${err}`);
        } finally {
          executing.delete(node.id);
          executed.add(node.id);
        }
      });

      await Promise.all(batchPromises);
    }

    this.progressIndicator.complete();
    return outputs;
  }
}
