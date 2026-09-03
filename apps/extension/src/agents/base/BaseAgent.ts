/**
 * Abstract base class for all agents.
 *
 * Provides tool-registry-aware execution via the protected `callTool()` helper.
 * Agents that need tools should accept a ToolRegistry in their constructor and
 * pass it to super(). Agents that don't need tools continue to work as before —
 * the toolRegistry parameter is optional.
 */

import { IAgent, IAgentContext } from '../../types';
import { ToolRegistry } from '../../services/tools/ToolRegistry';

export abstract class BaseAgent implements IAgent {
  abstract name: string;
  abstract description: string;

  constructor(
    protected logger: any,
    protected toolRegistry?: ToolRegistry,
  ) {}

  abstract execute(context: IAgentContext): Promise<string>;

  /**
   * Call a registered tool by name. Throws ToolNotFoundError if the tool
   * is not in the registry, or ToolCallError if execution fails.
   */
  protected async callTool<TOut = unknown>(toolName: string, input: unknown): Promise<TOut> {
    if (!this.toolRegistry) {
      throw new Error(
        `[${this.name}] callTool('${toolName}') requires a ToolRegistry but none was injected.`,
      );
    }
    return this.toolRegistry.call<TOut>(toolName, input);
  }

  /** Check if a tool is available in the registry. */
  protected hasTool(toolName: string): boolean {
    return this.toolRegistry?.has(toolName) ?? false;
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](`[${this.name}] ${message}`);
    } else if (this.logger && typeof this.logger.log === 'function') {
      this.logger.log(`[${this.name}] [${level.toUpperCase()}] ${message}`);
    }
  }

  protected validateContext(context: IAgentContext): boolean {
    if (!context.workspaceRoot) {
      this.log('Missing workspaceRoot in context', 'error');
      return false;
    }
    return true;
  }
}
