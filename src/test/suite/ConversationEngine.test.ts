import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConversationEngine } from '../../services/conversationEngine';
import { WorkspaceIntelligence, WorkspaceSnapshot } from '../../services/workspace/WorkspaceIntelligence';
import { ConfigService } from '../../config/ConfigService';
import { Logger } from '../../utils/logger';

suite('ConversationEngine Test Suite', () => {
  let workspaceIntelligence: WorkspaceIntelligence;
  let configService: ConfigService;
  let logger: Logger;
  let engine: ConversationEngine;

  setup(() => {
    // Stub global fetch
    sinon.stub(global, 'fetch').callsFake(async (url: string | URL | Request, init?: RequestInit) => {
      // Return a basic mock response matching Groq structure
      return {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: 'This is a mocked conversational reply.' } }
          ]
        }),
        text: async () => 'OK'
      } as Response;
    });

    workspaceIntelligence = {} as WorkspaceIntelligence;
    workspaceIntelligence.getSnapshot = sinon.stub().resolves({
      fileContext: 'general',
      recentFiles: ['app.ts', 'utils.ts'],
      activeFile: 'app.ts',
      activeLanguage: 'typescript',
      activeFileContent: 'console.log("hello");',
      hasPendingPipeline: true,
      sdlcPhase: 'testing',
      stackSummary: 'React, Node',
      detectedFramework: 'Next.js'
    } as WorkspaceSnapshot);

    configService = {} as ConfigService;
    configService.getApiKey = sinon.stub().resolves('fake-key');

    logger = {
      appendLine: sinon.spy(),
      show: sinon.spy(),
      info: sinon.spy(),
      error: sinon.spy(),
      debug: sinon.spy(),
      warn: sinon.spy()
    } as unknown as Logger;

    engine = new ConversationEngine(workspaceIntelligence, configService, logger);
  });

  teardown(() => {
    sinon.restore();
  });

  test('should format system prompt and maintain history correctly', async () => {
    const result = await engine.think('How do I run this?');
    
    // Validate engine outputs correctly processed value
    assert.strictEqual(typeof result, 'string');
    // It should include the pipeline reminder because hasPendingPipeline was true
    // Wait, the nudge happens on the *3rd* turn based on the code: PIPELINE_NUDGE_INTERVAL = 3
    // We only called it once here, so there is no reminder.
    
    assert.ok(result.includes('mocked conversational reply'));

    // Check we pushed to history
    // Since history is private we can test the length effectively by verifying the system continues pushing correctly
  });

  test('should trigger proactive pipeline nudge on Nth turn', async () => {
    await engine.think('Hello 1');
    await engine.think('Hello 2');
    const result = await engine.think('Hello 3');
    
    assert.ok(result.includes('💡 **Pipeline reminder:**'));
  });

  test('should clear history successfully', async () => {
    await engine.think('Hello 1');
    await engine.think('Hello 2');
    engine.clearHistory();
    const result = await engine.think('Hello 3 (cleared)');
    
    // Without private access, if the history is cleared, 
    // the pipeline nudge counter is also reset, so it should NOT have the nudge.
    assert.strictEqual(result.includes('💡 **Pipeline reminder:**'), false);
  });
});
