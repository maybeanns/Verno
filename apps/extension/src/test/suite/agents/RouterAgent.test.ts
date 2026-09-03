/**
 * Router agent tests
 */

import * as assert from 'assert';
import { RouterAgent } from '../../../agents/core/RouterAgent';

suite('RouterAgent Tests', () => {
  let agent: RouterAgent;

  setup(() => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    agent = new RouterAgent(mockLogger);
  });

  test('Agent should have correct name', () => {
    assert.strictEqual(agent.name, 'RouterAgent');
  });

  test('Agent should have description', () => {
    assert.ok(agent.description.length > 0);
  });

  // TODO: Add more comprehensive tests
});
