/**
 * RAGQueryTool — queries the Verno RAG (Retrieval-Augmented Generation) engine.
 * Tool name: "rag-query"
 *
 * Agents can call this tool to retrieve relevant code context, documentation,
 * or workspace knowledge without directly importing the ContextEngine.
 */

import { VernoTool } from '../ToolRegistry';
import { IndexingService } from '../../rag/IndexingService';
import { ImportTracer } from '../../rag/ImportTracer';
import { ContextEngine } from '../../rag/ContextEngine';

export interface RAGQueryInput {
  query: string;
  workspaceRoot: string;
  maxResults?: number;
}

export interface RAGQueryOutput {
  context: string;
  queryTokens: number;
}

export const RAGQueryTool: VernoTool<RAGQueryInput, RAGQueryOutput> = {
  name: 'rag-query',
  description: 'Query the workspace RAG engine to retrieve relevant code context and documentation.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language or code query to retrieve context for' },
      workspaceRoot: { type: 'string', description: 'Absolute path to the workspace root' },
      maxResults: { type: 'number', description: 'Maximum number of semantic chunks to return (default 5)' },
    },
    required: ['query', 'workspaceRoot'],
  },

  async execute(input: RAGQueryInput): Promise<RAGQueryOutput> {
    // ContextEngine requires ImportTracer + IndexingService + workspaceRoot.
    // We construct them inline so this tool is self-contained.
    const importTracer = new ImportTracer(input.workspaceRoot);
    // IndexingService may require extra args — use any cast for resilience
    const indexingService = new (IndexingService as any)(input.workspaceRoot);
    const engine = new ContextEngine(importTracer, indexingService, input.workspaceRoot);

    const maxChunks = input.maxResults ?? 5;
    const context = await engine.getTieredContext(input.query, maxChunks);

    return {
      context,
      queryTokens: input.query.split(/\s+/).length,
    };
  },
};
