/**
 * src/services/tools/index.ts
 *
 * Central export barrel + factory function that registers all built-in
 * Verno tools into the global ToolRegistry.
 *
 * Call `registerBuiltinTools(registry)` once in extension.ts activate()
 * to wire everything up.
 */

export { ToolRegistry, globalToolRegistry, ToolCallError, ToolNotFoundError } from './ToolRegistry';
export type { VernoTool, ToolInputSchema } from './ToolRegistry';

export { FileReadTool } from './tools/FileReadTool';
export { FileWriteTool } from './tools/FileWriteTool';
export { ShellCommandTool } from './tools/ShellCommandTool';
export { JiraCreateIssueTool } from './tools/JiraCreateIssueTool';
export { RAGQueryTool } from './tools/RAGQueryTool';

import { ToolRegistry } from './ToolRegistry';
import { FileReadTool } from './tools/FileReadTool';
import { FileWriteTool } from './tools/FileWriteTool';
import { ShellCommandTool } from './tools/ShellCommandTool';
import { JiraCreateIssueTool } from './tools/JiraCreateIssueTool';
import { RAGQueryTool } from './tools/RAGQueryTool';

/**
 * Register all built-in Verno tools into the provided registry.
 * Called once during extension activation.
 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  registry.register(FileReadTool);
  registry.register(FileWriteTool);
  registry.register(ShellCommandTool);
  registry.register(JiraCreateIssueTool);
  registry.register(RAGQueryTool);
}
