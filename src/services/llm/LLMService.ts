/**
 * Main LLM service interface and orchestration
 * Now supports both direct API calls and LangChain-based conversations
 */

import { ILLMProvider } from '../../types';
import { LangChainService, LangChainProviderType } from './LangChainService';

export class LLMService {
  private provider: ILLMProvider | null = null;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms
  private useLangChain: boolean = false;
  private langChainService: LangChainService | null = null;
  private onContextUsage?: (used: number, total: number) => void;

  /**
   * Set callback for context usage updates
   */
  setContextUsageCallback(callback: (used: number, total: number) => void) {
    this.onContextUsage = callback;
  }

  /**
   * Enable LangChain mode for conversation memory and advanced features
   */
  enableLangChain(): void {
    this.useLangChain = true;
    if (!this.langChainService) {
      this.langChainService = new LangChainService();
    }
  }

  /**
   * Disable LangChain mode and use direct provider API
   */
  disableLangChain(): void {
    this.useLangChain = false;
  }

  /**
   * Check if LangChain mode is enabled
   */
  isLangChainEnabled(): boolean {
    return this.useLangChain;
  }

  /**
   * Get the LangChain service instance
   */
  getLangChainService(): LangChainService | null {
    return this.langChainService;
  }

  /**
   * Initialize provider (supports both LangChain and direct mode)
   */
  async initialize(providerType: string, apiKey: string): Promise<void> {
    if (this.useLangChain && this.langChainService) {
      // Initialize LangChain provider
      const langChainProviderType = this.mapToLangChainProvider(providerType);
      await this.langChainService.initializeProvider(langChainProviderType, apiKey);
    } else {
      // Legacy direct API initialization
      if (this.provider) {
        await this.provider.initialize(apiKey);
      } else {
        throw new Error('Provider not set before initialization');
      }
    }
  }

  private estimateUsage(prompt: string) {
    if (!this.onContextUsage) return;
    try {
      const used = Math.ceil(prompt.length / 4); // Heuristic
      // Determine limit (safe defaults)
      const providerName = this.provider?.constructor.name.toLowerCase() || '';
      let limit = 8192; // default
      if (providerName.includes('gemini')) limit = 32768;
      if (providerName.includes('groq')) limit = 8192;

      this.onContextUsage(used, limit);
    } catch { }
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    this.estimateUsage(prompt);

    // If LangChain mode is enabled, delegate to LangChain service
    if (this.useLangChain && this.langChainService) {
      const sessionId = options?.sessionId as string | undefined;
      return await this.langChainService.chat(prompt, sessionId);
    }

    // Legacy mode: use direct provider API
    if (!this.provider) {
      throw new Error('LLM provider not initialized. Please set a provider first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.provider.generateText(prompt, options);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay);
        }
      }
    }

    throw lastError || new Error('Failed to generate text after retries');
  }

  /**
   * Streaming generation API. If the provider supports streaming, use it.
   * Otherwise, fall back to a single-shot generateText and emit as one token.
   */
  private globalTokenListener?: (token: string) => void;

  setGlobalTokenListener(listener: (token: string) => void): void {
    this.globalTokenListener = listener;
  }

  async streamGenerate(
    prompt: string,
    options: Record<string, unknown> | undefined,
    onToken: (token: string) => void
  ): Promise<void> {
    this.estimateUsage(prompt);

    const hookedOnToken = (token: string) => {
      onToken(token);
      if (this.globalTokenListener) {
        this.globalTokenListener(token);
      }
    };

    // If LangChain mode is enabled, use LangChain streaming
    if (this.useLangChain && this.langChainService) {
      const sessionId = options?.sessionId as string | undefined;
      await this.langChainService.streamChat(prompt, sessionId, hookedOnToken);
      return;
    }

    // Legacy mode: check provider streaming support
    if (!this.provider) {
      throw new Error('LLM provider not initialized. Please set a provider first.');
    }

    const providerAny: any = this.provider as any;
    if (typeof providerAny.streamGenerate === 'function') {
      await providerAny.streamGenerate(prompt, options, hookedOnToken);
      return;
    }

    // Fallback: single-shot and emit whole text as one token
    const text = await this.generateText(prompt, options);
    hookedOnToken(text);
  }

  setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  getProvider(): ILLMProvider | null {
    return this.provider;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Map provider type string to LangChain provider type
   */
  private mapToLangChainProvider(providerType: string): LangChainProviderType {
    const lowerType = providerType.toLowerCase();
    if (lowerType.includes('openai')) return 'openai';
    if (lowerType.includes('anthropic') || lowerType.includes('claude')) return 'anthropic';
    if (lowerType.includes('gemini') || lowerType.includes('google')) return 'gemini';
    if (lowerType.includes('groq')) return 'groq';

    // Default to gemini if unknown
    return 'gemini';
  }
}
