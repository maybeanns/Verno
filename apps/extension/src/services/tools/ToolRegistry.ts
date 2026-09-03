/**
 * ToolRegistry — MCP-inspired centralized tool registry for Verno agents.
 *
 * Agents declare the tools they need by name. Tools are registered once
 * (typically in extension.ts activation) and resolved at call time.
 * This decouples agent logic from concrete service implementations,
 * making tools independently testable and swappable.
 *
 * Protocol mirrors the Model Context Protocol (MCP) tool schema:
 *   https://spec.modelcontextprotocol.io/specification/server/tools/
 */

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
}

export interface VernoTool<TInput = unknown, TOutput = unknown> {
  /** Unique tool name. Convention: kebab-case (e.g. "file-read", "shell-command") */
  name: string;
  /** One-sentence description of what the tool does */
  description: string;
  /** JSON-schema-compatible input shape for type-safe dispatch */
  inputSchema: ToolInputSchema;
  /** Execute the tool with validated input. Throws on error. */
  execute(input: TInput): Promise<TOutput>;
}

export class ToolCallError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly cause: unknown,
  ) {
    super(`Tool '${toolName}' failed: ${String(cause)}`);
    this.name = 'ToolCallError';
  }
}

export class ToolNotFoundError extends Error {
  constructor(public readonly toolName: string) {
    super(`Tool '${toolName}' is not registered in the ToolRegistry`);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, VernoTool<any, any>>();

  /** Register a tool. Overwrites any existing tool with the same name. */
  public register<TIn, TOut>(tool: VernoTool<TIn, TOut>): void {
    this.tools.set(tool.name, tool);
  }

  /** Unregister a tool by name. */
  public unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Check if a tool is registered. */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get tool metadata without executing it. */
  public get(name: string): VernoTool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tools (metadata only, no execute fn). */
  public list(): Array<Omit<VernoTool, 'execute'>> {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  /**
   * Call a registered tool by name. Validates tool exists, then delegates.
   * Wraps any thrown error in a ToolCallError for consistent error handling.
   */
  public async call<TOut = unknown>(name: string, input: unknown): Promise<TOut> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }
    try {
      return (await tool.execute(input)) as TOut;
    } catch (err) {
      if (err instanceof ToolCallError) throw err;
      throw new ToolCallError(name, err);
    }
  }

  /** Generate a tool manifest string for injection into LLM system prompts. */
  public toManifestString(): string {
    const tools = this.list();
    if (tools.length === 0) return 'No tools registered.';
    return tools
      .map(t => `- **${t.name}**: ${t.description}`)
      .join('\n');
  }
}

/** Singleton registry — shared across all agents in one extension host process. */
export const globalToolRegistry = new ToolRegistry();
