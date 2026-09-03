/**
 * Agent-specific type definitions
 */

import { IAgent, IAgentContext } from './index';

export interface ISpecializedAgent extends IAgent {
  validateInput(context: IAgentContext): boolean;
  preProcess(context: IAgentContext): Promise<IAgentContext>;
  postProcess(output: string): Promise<string>;
}

export interface IRouterAgentConfig {
  agents: Map<string, IAgent>;
  defaultAgent: string;
}

export interface IPlannerOutput {
  steps: string[];
  estimatedDuration: number;
  agents: string[];
}

export interface IReviewResult {
  issues: IReviewIssue[];
  score: number;
  suggestions: string[];
}

export interface IReviewIssue {
  severity: 'error' | 'warning' | 'info';
  line: number;
  message: string;
  suggestion?: string;
}

export interface IDebugInfo {
  breakpoints: number;
  watchExpressions: string[];
  callStack: IStackFrame[];
  variables: Record<string, unknown>;
}

export interface IStackFrame {
  functionName: string;
  filePath: string;
  line: number;
  column: number;
}

export interface IRefactorSuggestion {
  type: 'extract-method' | 'rename' | 'simplify' | 'optimize';
  description: string;
  beforeCode: string;
  afterCode: string;
  line: number;
}
