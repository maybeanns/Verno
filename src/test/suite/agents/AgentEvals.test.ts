import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BlackboardState } from '../../../agents/core/BlackboardState';
import { GraphOrchestrator } from '../../../agents/core/GraphOrchestrator';
import { AgentRegistry } from '../../../agents/base/AgentRegistry';
import { SandboxService } from '../../../services/sandbox/SandboxService';
import { DebateOrchestrator } from '../../../agents/DebateOrchestrator';
import { LLMService } from '../../../services/llm';

suite('Agent Evals & Verification Test Suite', () => {
  
  test('BlackboardState manages and updates state correctly', () => {
    const blackboard = new BlackboardState();
    
    // Initial state check
    assert.strictEqual(blackboard.get().prd, null);
    
    // Update state
    blackboard.update((state) => {
      state.prd = {
        title: 'Test PRD',
        sections: [{ title: 'Overview', content: 'Description here' }],
        status: 'draft'
      };
    });
    
    const updated = blackboard.get();
    assert.ok(updated.prd);
    assert.strictEqual(updated.prd.title, 'Test PRD');
    
    // Issue logging
    blackboard.addIssue({
      severity: 'high',
      description: 'Lint failure',
      context: 'const x = 1;'
    });
    
    assert.strictEqual(blackboard.get().issues.length, 1);
    assert.strictEqual(blackboard.get().issues[0].severity, 'high');
    
    blackboard.clearIssues();
    assert.strictEqual(blackboard.get().issues.length, 0);
  });

  test('GraphOrchestrator executes nodes in correct dependency order', async () => {
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
    const registry = new AgentRegistry();
    const orchestrator = new GraphOrchestrator(mockLogger, registry);
    
    const executedOrder: string[] = [];
    
    orchestrator.registerNode({
      id: 'nodeA',
      name: 'Node A',
      dependencies: [],
      run: async () => {
        executedOrder.push('nodeA');
        return 'result A';
      }
    });

    orchestrator.registerNode({
      id: 'nodeB',
      name: 'Node B',
      dependencies: ['nodeA'],
      run: async () => {
        executedOrder.push('nodeB');
        return 'result B';
      }
    });

    const blackboard = new BlackboardState();
    const context = { workspaceRoot: process.cwd(), metadata: {} } as any;
    const outputs = await orchestrator.executeGraph(context, blackboard);
    
    assert.deepStrictEqual(executedOrder, ['nodeA', 'nodeB']);
    assert.strictEqual(outputs.nodeA, 'result A');
    assert.strictEqual(outputs.nodeB, 'result B');
  });

  test('SandboxService successfully creates, runs commands, and cleans up sandbox', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verno-test-workspace-'));
    fs.writeFileSync(path.join(workspaceRoot, 'hello.txt'), 'Hello World');
    
    const sandbox = new SandboxService();
    const sandboxPath = await sandbox.createSandbox(workspaceRoot);
    
    assert.ok(sandboxPath);
    assert.ok(fs.existsSync(path.join(sandboxPath, 'hello.txt')));
    
    // Test execution
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'echo hello' : 'echo hello';
    const res = await sandbox.executeCommand(cmd);
    
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('hello'));
    
    // Modify file inside sandbox and sync back
    fs.writeFileSync(path.join(sandboxPath, 'hello.txt'), 'Hello Sandboxed World');
    await sandbox.syncBack(workspaceRoot, ['hello.txt']);
    
    assert.strictEqual(fs.readFileSync(path.join(workspaceRoot, 'hello.txt'), 'utf-8'), 'Hello Sandboxed World');
    
    // Cleanup
    sandbox.clean();
    assert.strictEqual(sandbox.getPath(), null);
    assert.strictEqual(fs.existsSync(sandboxPath), false);
    
    // Clean temp workspace
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  test('DebateOrchestrator runs true round-robin debate and convergence', async () => {
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
    const llm = new LLMService();
    const mockProvider: any = {
      initialize: async () => {},
      generateText: async (prompt: string) => {
        if (prompt.includes('reached a clear consensus')) return 'YES';
        return `response: ${prompt.substring(0, 30)}`;
      },
      getModelInfo: () => ({})
    };
    llm.setProvider(mockProvider);
    
    const orchestrator = new DebateOrchestrator(llm, mockLogger as any);
    const messages: any[] = [];
    const prd = await orchestrator.runDebate('build a furniture app', (msg) => {
      messages.push(msg);
    });
    
    assert.ok(prd);
    assert.strictEqual(prd.status, 'draft');
    assert.ok(messages.length > 0);
    // Product Manager consensus message is the last one
    assert.strictEqual(messages[messages.length - 1].agentId, 'pm');
  });
});
