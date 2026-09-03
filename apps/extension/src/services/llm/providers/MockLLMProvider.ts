import { ILLMProvider } from '../../../types';

export class MockLLMProvider implements ILLMProvider {
  private responses: string[] = [];
  private transcripts: string[] = [];
  
  public enqueueResponse(response: string) {
    this.responses.push(response);
  }

  public enqueueTranscript(transcript: string) {
    this.transcripts.push(transcript);
  }

  public clearQueue() {
    this.responses = [];
    this.transcripts = [];
  }

  async initialize(apiKey: string): Promise<void> {
    // Mock successful initialization
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    const res = this.responses.shift();
    if (res === undefined) {
      throw new Error(`MockLLMProvider: No response enqueued. Prompt was: ${prompt}`);
    }
    return res;
  }

  async streamGenerate(
    prompt: string,
    options: Record<string, unknown> | undefined,
    onToken: (token: string) => void
  ): Promise<void> {
    const res = this.responses.shift();
    if (res === undefined) {
      throw new Error(`MockLLMProvider: No response enqueued for stream. Prompt was: ${prompt}`);
    }
    // Simulate streaming by splitting by chunk (spaces for simple text splitting)
    const chunks = res.match(/(.*?[\s]|\S+$)/g) || [res];
    for (const chunk of chunks) {
      onToken(chunk);
      // Optional: Wait 1ms to simulate tiny async gap or just stream sync 
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  getModelInfo(): Record<string, unknown> {
    return {
      provider: 'mock',
      name: 'mock-model-test'
    };
  }

  async transcribeAudio(base64Audio: string): Promise<string> {
    const res = this.transcripts.shift();
    if (res === undefined) {
      throw new Error('MockLLMProvider: No transcript enqueued.');
    }
    return res;
  }
}
