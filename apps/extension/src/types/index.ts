/**
 * Shared type definitions and interfaces for the extension
 */

export interface IAgent {
  name: string;
  description: string;
  execute(context: IAgentContext): Promise<string>;
}

import * as vscode from 'vscode';

export interface IAgentContext {
  workspaceRoot: string;
  selectedText?: string;
  filePath?: string;
  fileContent?: string;
  metadata?: Record<string, unknown>;
  cancellationToken?: vscode.CancellationToken;
}

export interface IWorkflowStep {
  agentName: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface IWorkflow {
  steps: IWorkflowStep[];
  context: IAgentContext;
}

export interface ILLMProvider {
  initialize(apiKey: string): Promise<void>;
  generateText(prompt: string, options?: Record<string, unknown>): Promise<string>;
  // Optional streaming generation API. onToken is called for every token/chunk produced.
  streamGenerate?: (
    prompt: string,
    options: Record<string, unknown> | undefined,
    onToken: (token: string) => void
  ) => Promise<void>;
  getModelInfo(): Record<string, unknown>;
  // Optional audio transcription
  transcribeAudio?: (base64Audio: string) => Promise<string>;
}

export interface IVoiceRecorder {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  isRecording(): boolean;
}

export interface IFileService {
  createFile(filePath: string, content: string): Promise<void>;
  readFile(filePath: string): Promise<string>;
  updateFile(filePath: string, content: string): Promise<void>;
}

export interface IConfigService {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Record<string, unknown>;
}
