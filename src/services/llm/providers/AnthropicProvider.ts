import { ILLMProvider } from '../../../types';

/** Supported Anthropic model identifiers */
export type AnthropicModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-haiku-20240307'
  | 'claude-3-sonnet-20240229';

export class AnthropicProvider implements ILLMProvider {
  private apiKey: string = '';
  private model: AnthropicModel = 'claude-3-5-sonnet-20241022';
  private readonly apiEndpoint = 'https://api.anthropic.com/v1/messages';
  private readonly anthropicVersion = '2023-06-01';

  setModel(model: AnthropicModel): void {
    this.model = model;
  }

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key — must start with sk-ant-');
    }
    this.apiKey = apiKey;
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (!this.apiKey) { throw new Error('Anthropic API key not set'); }

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: (options?.maxTokens as number) || 4096,
        system: 'You are a helpful code generation assistant.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error ${response.status}: ${err?.error?.message || response.statusText}`);
    }

    const data: any = await response.json();
    return data.content?.[0]?.text || '';
  }

  async streamGenerate(
    prompt: string,
    options?: Record<string, unknown>,
    onToken?: (token: string) => void
  ): Promise<void> {
    if (!this.apiKey) { throw new Error('Anthropic API key not set'); }
    if (!onToken) { return; }

    let response: Response;
    try {
      response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.model,
          max_tokens: (options?.maxTokens as number) || 4096,
          system: 'You are a helpful code generation assistant.',
          messages: [{ role: 'user', content: prompt }],
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
            const event: any = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              onToken(event.delta.text);
            }
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
      provider: 'Anthropic',
      model: this.model,
      endpoint: this.apiEndpoint,
    };
  }

  private buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion,
      'Content-Type': 'application/json',
    };
  }
}
