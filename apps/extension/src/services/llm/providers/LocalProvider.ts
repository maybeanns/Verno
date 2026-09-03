/**
 * Local LLM provider implementation for local models
 */

import { ILLMProvider } from '../../../types';

export class LocalProvider implements ILLMProvider {
  private model: string = 'local-model';
  private endpoint: string = 'http://localhost:8000';

  async initialize(apiKey: string): Promise<void> {
    // TODO: Initialize connection to local LLM server
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    // TODO: Implement local model API call
    return '';
  }

  getModelInfo(): Record<string, unknown> {
    return {
      provider: 'Local',
      model: this.model,
      endpoint: this.endpoint,
      version: '1.0'
    };
  }
}
