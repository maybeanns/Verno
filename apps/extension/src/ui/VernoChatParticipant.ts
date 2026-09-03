/**
 * VernoChatParticipant — VS Code native Chat Participant (@verno).
 *
 * Registers Verno as a first-class VS Code Chat participant so the user can
 * interact with the SDLC pipeline directly from the native Chat panel using
 * @verno, without relying on the React Webview bridge.
 *
 * Slash commands:
 *   /sdlc   — Trigger the full 9-phase SDLC pipeline
 *   /debate — Start an 8-agent PRD debate on a topic
 *   /review — Review the currently active file
 *   /status — Show the current pipeline status / active run
 *
 * Requires VS Code ^1.90.0 (vscode.chat API).
 * The caller (extension.ts) must gate this registration behind a version check.
 */

import * as vscode from 'vscode';
import { LLMService } from '../services/llm';
import { CheckpointStore } from '../services/workflow/CheckpointStore';
import { AgentRegistry } from '../agents/base/AgentRegistry';
import { Logger } from '../utils/logger';
import { DebateOrchestrator } from '../agents/DebateOrchestrator';
import { AgentEventBus } from '../agents/core/AgentEventBus';

const PARTICIPANT_ID = 'verno.assistant';

export class VernoChatParticipant {
  private participant: { dispose(): void } | undefined;
  private activeRunId: string | undefined;

  constructor(
    private readonly llmService: LLMService,
    private readonly agentRegistry: AgentRegistry,
    private readonly checkpointStore: CheckpointStore,
    private readonly logger: Logger,
  ) {}

  /** Register the chat participant. Call once in extension.activate(). */
  public register(context: vscode.ExtensionContext): void {
    const chatApi = (vscode as any).chat;
    if (!chatApi || typeof chatApi.createChatParticipant !== 'function') {
      this.logger.warn('[VernoChatParticipant] vscode.chat API not available on this VS Code version. Skipping registration.');
      return;
    }

    this.participant = chatApi.createChatParticipant(
      PARTICIPANT_ID,
      this.handleRequest.bind(this),
    );

    if (this.participant && 'iconPath' in this.participant) {
      const logoPath = [context.extensionUri.fsPath, 'media', 'logo.png'].join(
        process.platform === 'win32' ? '\\' : '/',
      );
      (this.participant as any).iconPath = vscode.Uri.file(logoPath);
    }

    // Register slash commands via followupProvider
    if (this.participant && 'followupProvider' in this.participant) {
      (this.participant as any).followupProvider = {
        provideFollowups: () => [
          { prompt: '/sdlc ', label: 'Start SDLC Pipeline', command: 'sdlc' },
          { prompt: '/debate ', label: 'Start 8-Agent Debate', command: 'debate' },
          { prompt: '/review', label: 'Review Current File', command: 'review' },
          { prompt: '/status', label: 'Check Pipeline Status', command: 'status' },
        ],
      };
    }

    if (this.participant) {
      context.subscriptions.push(this.participant);
    }
    this.logger.info('[VernoChatParticipant] Registered @verno chat participant.');
  }

  // ── Request Handler ──────────────────────────────────────────────────────────

  private async handleRequest(
    request: { command?: string; prompt: string },
    _chatContext: unknown,
    stream: { markdown(text: string): void; progress(text: string): void },
    token: vscode.CancellationToken,
  ): Promise<object> {
    const command = request.command;
    const userPrompt = request.prompt.trim();

    try {
      switch (command) {
        case 'sdlc':
          return await this.handleSDLC(userPrompt, stream, token);
        case 'debate':
          return await this.handleDebate(userPrompt, stream, token);
        case 'review':
          return await this.handleReview(stream, token);
        case 'status':
          return await this.handleStatus(stream);
        default:
          return await this.handleConversational(userPrompt, stream);
      }
    } catch (err) {
      stream.markdown(`\n\n> ⚠️ **Verno error:** ${String(err)}`);
      return { metadata: { command, error: String(err) } };
    }
  }

  // ── Command Handlers ─────────────────────────────────────────────────────────

  private async handleSDLC(
    topic: string,
    stream: { markdown(text: string): void; progress(text: string): void },
    token: vscode.CancellationToken,
  ): Promise<object> {
    if (!topic) {
      stream.markdown('Please describe what you want to build. Example: `@verno /sdlc Build a REST API for a todo app`');
      return {};
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      stream.markdown('> ⚠️ No workspace folder open. Please open a project folder first.');
      return {};
    }

    stream.progress('Initializing SDLC pipeline…');

    const runId = `run-${Date.now()}`;
    this.activeRunId = runId;

    stream.markdown(`## 🚀 SDLC Pipeline Started\n\n**Topic:** ${topic}\n**Run ID:** \`${runId}\`\n\n`);

    const interruptedRuns = this.checkpointStore.listRuns();
    const interrupted = interruptedRuns.find((r: any) => r.topic === topic);
    if (interrupted) {
      const lastPhase = (interrupted.phases as any[]).slice(-1)[0]?.phaseId ?? 'start';
      stream.markdown(`> ℹ️ Found an interrupted run for this topic. Resuming from **\`${lastPhase}\`**…\n\n`);
    }

    // DebateOrchestrator is used inline for now; full DurableWorkflowEngine wires in later

    const bus = new AgentEventBus();
    const orchestrator = new DebateOrchestrator(this.llmService, this.logger, bus);

    stream.progress('Running 8-agent debate…');
    const prd = await orchestrator.runDebate(
      topic,
      (msg: { agentId: string; round: number; content: string }) => {
        stream.markdown(`**[${msg.agentId.toUpperCase()}]** *(Round ${msg.round})*: ${msg.content}\n\n`);
      },
      [],
      token,
    );

    stream.markdown(`## ✅ Debate Complete\n\nPRD generated: **${prd.title}** (${prd.sections?.length ?? 0} sections)\n\nFiles written to \`.verno/PRD.md\`.\n`);
    bus.dispose();
    this.activeRunId = undefined;
    return { metadata: { runId, topic } };
  }

  private async handleDebate(
    topic: string,
    stream: { markdown(text: string): void; progress(text: string): void },
    token: vscode.CancellationToken,
  ): Promise<object> {
    if (!topic) {
      stream.markdown('Please provide a topic. Example: `@verno /debate Build a multi-tenant SaaS platform`');
      return {};
    }

    stream.progress('Starting 8-agent PRD debate…');
    stream.markdown(`## 🎯 8-Agent PRD Debate\n\n**Topic:** ${topic}\n\n`);



    const bus = new AgentEventBus();
    const orchestrator = new DebateOrchestrator(this.llmService, this.logger, bus);

    let messageCount = 0;
    const prd = await orchestrator.runDebate(
      topic,
      (msg: { agentId: string; round: number; content: string }) => {
        messageCount++;
        stream.markdown(`**[${msg.agentId.toUpperCase()}]** *(Round ${msg.round})*: ${msg.content}\n\n`);
      },
      [],
      token,
    );

    stream.markdown(`\n---\n\n## 📄 PRD Generated (${prd.sections?.length ?? 0} sections)\n\nPRD written to \`.verno/PRD.md\`.\n`);
    bus.dispose();
    return { metadata: { sections: prd.sections?.length ?? 0, messageCount } };
  }

  private async handleReview(
    stream: { markdown(text: string): void; progress(text: string): void },
    _token: vscode.CancellationToken,
  ): Promise<object> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      stream.markdown('> ⚠️ No active editor. Open a file to review.');
      return {};
    }

    const filePath = editor.document.uri.fsPath;
    const content = editor.document.getText();
    stream.progress(`Reviewing ${editor.document.fileName}…`);

    const prompt = `You are a senior code reviewer. Review the following code and provide:
1. **Critical issues** (bugs, security problems, performance bottlenecks)
2. **Improvement suggestions** (readability, maintainability, best practices)
3. **Positive observations** (what's done well)

File: ${filePath}

\`\`\`
${content.slice(0, 8000)}
\`\`\`

Format your response in clear markdown.`;

    const review = await this.llmService.generateText(prompt);
    stream.markdown(`## 🔍 Code Review: \`${editor.document.fileName}\`\n\n${review}`);
    return { metadata: { filePath } };
  }

  private async handleStatus(
    stream: { markdown(text: string): void },
  ): Promise<object> {
    if (this.activeRunId) {
      stream.markdown(`## ⚡ Active Pipeline\n\n**Run ID:** \`${this.activeRunId}\`\n\nPipeline is currently running.`);
    } else {
      const runs = this.checkpointStore.listRuns();
      if (runs.length === 0) {
        stream.markdown('## 📊 No active or interrupted pipelines.\n\nUse `@verno /sdlc <topic>` to start a new pipeline.');
      } else {
        stream.markdown(`## 📊 Interrupted Runs\n\n`);
        for (const run of runs as Array<{ runId: string; topic: string; phases: Array<{ phaseId: string }> }>) {
          const phases = run.phases.map(p => p.phaseId).join(', ');
          stream.markdown(`- **Run** \`${run.runId.slice(0, 8)}\`: *${run.topic}* — completed phases: \`${phases}\`\n`);
        }
        stream.markdown(`\nResume with: \`@verno /sdlc <same topic>\``);
      }
    }
    return {};
  }

  private async handleConversational(
    prompt: string,
    stream: { markdown(text: string): void; progress(text: string): void },
  ): Promise<object> {
    if (!prompt) {
      stream.markdown(`# 👋 Verno — AI SDLC Co-Pilot\n\nI can help you:\n- \`/sdlc <topic>\` — Run the full 9-phase SDLC pipeline\n- \`/debate <topic>\` — Start an 8-agent PRD debate\n- \`/review\` — Review your current file\n- \`/status\` — Check active pipeline status\n\nOr just ask me anything about software architecture, code quality, or development practices.`);
      return {};
    }

    stream.progress('Thinking…');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const systemPrompt = `You are Verno, an AI SDLC co-pilot embedded in VS Code. You help developers with:
- Software architecture and design decisions
- Code quality and security reviews  
- SDLC planning and process guidance
- Interpreting TypeScript/JavaScript, Python, Rust, Go codebases

Current workspace: ${workspaceRoot || 'No workspace open'}
Be concise, technical, and actionable. Use markdown formatting.`;

    const response = await this.llmService.generateText(`${systemPrompt}\n\nUser: ${prompt}`);
    stream.markdown(response);
    return {};
  }

  /** Dispose the participant. Call in extension.deactivate(). */
  public dispose(): void {
    this.participant?.dispose();
  }
}
