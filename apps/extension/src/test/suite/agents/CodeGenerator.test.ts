/**
 * Code generator agent tests
 */

import * as assert from 'assert';
import { CodeGeneratorAgent } from '../../../agents/specialized/CodeGeneratorAgent';
import { LLMService } from '../../../services/llm';
import { FileService } from '../../../services/file/FileService';

suite('CodeGeneratorAgent Tests', () => {
  let agent: CodeGeneratorAgent;
  let mockLogger: any;
  let mockLLMService: LLMService;
  let mockFileService: FileService;

  setup(() => {
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    mockLLMService = new LLMService();
    mockFileService = new FileService();
    agent = new CodeGeneratorAgent(mockLogger, mockLLMService, mockFileService);
  });

  test('Agent should have correct name', () => {
    assert.strictEqual(agent.name, 'CodeGeneratorAgent');
  });

  test('Agent should have description', () => {
    assert.ok(agent.description.length > 0);
  });

  // TODO: Add more comprehensive tests
});
