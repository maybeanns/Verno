import { ILLMProvider } from '../../../types';

/** Supported OpenAI model identifiers for Verno */
export type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo';

export class OpenAIProvider implements ILLMProvider {
  private apiKey: string = '';
  private model: OpenAIModel = 'gpt-4o';
  private readonly apiEndpoint = 'https://api.openai.com/v1/chat/completions';
  private onUsage?: (promptTokens: number, completionTokens: number) => void;

  /** Set the model to use for subsequent requests. */
  setModel(model: OpenAIModel): void {
    this.model = model;
  }

  /** Register a callback to receive token usage data after each non-streaming call. */
  setUsageCallback(callback: (promptTokens: number, completionTokens: number) => void): void {
    this.onUsage = callback;
  }

  async initialize(apiKey: string): Promise<void> {
    // Accept both legacy sk- and new sk-proj- / sk-org- key formats
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key — must start with sk-');
    }
    this.apiKey = apiKey;
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (!this.apiKey) { throw new Error('OpenAI API key not set'); }

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful code generation assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: (options?.temperature as number) ?? 0.7,
        max_tokens: (options?.maxTokens as number) || 4096,
      }),
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error ${response.status}: ${err?.error?.message || response.statusText}`);
    }

    const data: any = await response.json();
    if (this.onUsage && data.usage) {
      this.onUsage(data.usage.prompt_tokens, data.usage.completion_tokens);
    }
    return data.choices?.[0]?.message?.content || '';
  }

  async streamGenerate(
    prompt: string,
    options?: Record<string, unknown>,
    onToken?: (token: string) => void
  ): Promise<void> {
    if (!this.apiKey) { throw new Error('OpenAI API key not set'); }
    if (!onToken) { return; }

    let response: Response;
    try {
      response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful code generation assistant.' },
            { role: 'user', content: prompt },
          ],
          temperature: (options?.temperature as number) ?? 0.7,
          max_tokens: (options?.maxTokens as number) || 4096,
          stream: true,
        }),
      });
    } catch (err: any) {
      const text = await this.generateText(prompt, options);
      onToken(text);
      return;
    }

    if (!response.ok || !response.body) {
      const text = await this.generateText(prompt, options);
      onToken(text);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) { continue; }
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { return; }
          try {
            const chunk: any = JSON.parse(jsonStr);
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) { onToken(token); }
          } catch {
            // Skip malformed SSE chunk
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getModelInfo(): Record<string, unknown> {
    return {
      provider: 'OpenAI',
      model: this.model,
      endpoint: this.apiEndpoint,
    };
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
