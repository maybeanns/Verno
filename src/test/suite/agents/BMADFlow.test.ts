import * as assert from 'assert';
import { AgentRegistry } from '../../../agents/base/AgentRegistry';
import { MultiAgentManager } from '../../../agents/MultiAgentManager';
import { BrainstormAgent } from '../../../agents/BMAD/BrainstormAgent';
import { ModelAgent } from '../../../agents/BMAD/ModelAgent';
import { DecideAgent } from '../../../agents/BMAD/DecideAgent';
import { ActAgent } from '../../../agents/BMAD/ActAgent';
import { LLMService } from '../../../services/llm';
import { FileService } from '../../../services/file/FileService';

suite('BMAD Flow Tests', () => {
  test('MultiAgentManager runs stages and returns outputs', async () => {
    const mockLogger: any = { info: () => {}, warn: () => {}, error: () => {} };
    const registry = new AgentRegistry();
    const llm = new LLMService();

    // Provide a mock provider that returns canned responses
    const mockProvider: any = {
      initialize: async () => {},
      generateText: async (prompt: string) => `response for: ${prompt}`,
      streamGenerate: async (prompt: string, opts: any, onToken: (t: string) => void) => {
        onToken(`part1:${prompt}`);
        onToken(`part2:${prompt}`);
      },
      getModelInfo: () => ({})
    };
    llm.setProvider(mockProvider);

    const fileService = new FileService();
    const manager = new MultiAgentManager(mockLogger, registry, llm, fileService);

    // register agents directly
    registry.register('brainstorm', new BrainstormAgent(mockLogger, llm) as any);
    registry.register('model', new ModelAgent(mockLogger, llm) as any);
    registry.register('decide', new DecideAgent(mockLogger, llm) as any);
    registry.register('act', new ActAgent(mockLogger, llm) as any);

    const context = { workspaceRoot: process.cwd(), metadata: { userRequest: 'test request' } } as any;
    const outputs = await manager.runPipeline(context, ['brainstorm', 'model', 'decide', 'act']);

    assert.ok(outputs.brainstorm?.includes('part1') || outputs.brainstorm?.includes('response for'));
    assert.ok(outputs.model);
    assert.ok(outputs.decide);
    assert.ok(outputs.act);
  });
});
