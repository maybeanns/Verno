import * as assert from 'assert';
import { LLMService } from '../../../services/llm';

suite('LLM Streaming Tests', () => {
  test('streamGenerate falls back to single-shot when provider lacks streaming', async () => {
    const llm = new LLMService();
    const mockProvider: any = {
      initialize: async () => {},
      generateText: async (prompt: string) => `full:${prompt}`,
      getModelInfo: () => ({})
    };
    llm.setProvider(mockProvider);

    let captured = '';
    await llm.streamGenerate('hello', undefined, (t) => { captured += t; });
    assert.strictEqual(captured, 'full:hello');
  });

  test('streamGenerate uses provider.streamGenerate when available', async () => {
    const llm = new LLMService();
    const mockProvider: any = {
      initialize: async () => {},
      generateText: async (prompt: string) => `full:${prompt}`,
      streamGenerate: async (prompt: string, opts: any, onToken: (t: string) => void) => {
        onToken('a');
        onToken('b');
        onToken('c');
      },
      getModelInfo: () => ({})
    };
    llm.setProvider(mockProvider);
    let captured = '';
    await llm.streamGenerate('hello', undefined, (t) => { captured += t; });
    assert.strictEqual(captured, 'abc');
  });
});
