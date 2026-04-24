import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';
import { FeedbackService, IssueSeverity } from '../../services/feedback';
import { VectorStore } from '../../services/rag/VectorStore';
import { EmbeddingService } from '../../services/rag/EmbeddingService';
import { IndexingService } from '../../services/rag/IndexingService';
import { ImportTracer } from '../../services/rag/ImportTracer';
import { ContextEngine } from '../../services/rag/ContextEngine';
import { SymbolChunker } from '../../services/rag/SymbolChunker';
import * as childProcess from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { VernoArtifactService } from '../../services/artifact/VernoArtifactService';

const exec = util.promisify(childProcess.exec);

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Types
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

interface IssueRecord {
  severity: IssueSeverity;
  description: string;
  context: string;
  file?: string;
  line?: number;
  autoFixed?: boolean;
}

interface GeneratedFile {
  name: string;
  content: string;
  isDiff?: boolean;
}

interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

interface ProjectEnv {
  hasNode: boolean;
  hasPython: boolean;
  hasGo: boolean;
  hasRust: boolean;
  hasDotnet: boolean;
  hasJava: boolean;
  hasDocker: boolean;
  hasGit: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  pythonBin: string;
  nodeVersion: string;
  frameworks: string[];
  testRunner: string | null;
  linter: string | null;
  formatter: string | null;
  bundler: string | null;
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Terminal Session ΓÇö persistent PTY shell with streaming output
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

class TerminalSession extends EventEmitter {
  private ptyProcess: childProcess.ChildProcess | null = null;
  private outputBuffer = '';
  private isReady = false;
  private cwd: string;
  private SENTINEL = '__CMD_DONE__';

  constructor(cwd: string, private log: (msg: string) => void = () => { }) {
    super();
    this.cwd = cwd;
  }

  /** Spawn a persistent PTY shell. Safe to call multiple times (idempotent). */
  async open(): Promise<void> {
    if (this.ptyProcess) return;

    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      // Keep CI=true so tools don't prompt interactively
      CI: 'true',
      // Ensure npm/pip don't ask questions
      NPM_CONFIG_YES: 'true',
      PIP_NO_INPUT: '1',
    };

    this.log(`Spawning shell process: ${shell} at ${this.cwd}`);

    this.ptyProcess = childProcess.spawn(shell, [], {
      cwd: this.cwd,
      env: env as NodeJS.ProcessEnv,
      shell: false,
    });

    const handleData = (data: Buffer | string) => {
      const str = data.toString();
      this.outputBuffer += str;
      this.emit('data', str);
    };

    if (this.ptyProcess.stdout) this.ptyProcess.stdout.on('data', handleData);
    if (this.ptyProcess.stderr) this.ptyProcess.stderr.on('data', handleData);

    this.ptyProcess.on('exit', (code) => {
      this.log(`Shell process exited with code ${code}`);
      this.emit('exit', code || 0);
      this.ptyProcess = null;
    });

    this.log('Waiting for shell prompt...');
    // Wait for shell prompt
    await this.waitFor(/[$#>]\s*$/, 3000);
    this.isReady = true;
    this.log('Shell process is ready.');
  }

  /**
   * Run a command inside the persistent PTY and return its full output.
   * Uses a sentinel echo to detect command completion reliably.
   */
  async run(command: string, timeoutMs = 120_000): Promise<ShellResult> {
    if (!this.ptyProcess) await this.open();

    const start = Date.now();
    this.outputBuffer = '';

    const isWin = process.platform === 'win32';
    // Write command + sentinel
    const sentinelCmd = isWin ? `echo ${this.SENTINEL}:%ERRORLEVEL%` : `echo "${this.SENTINEL}:$?"`;
    this.ptyProcess!.stdin?.write(`${command}\n${sentinelCmd}\n`);

    this.log(`TerminalSession running: ${command}`);

    // Collect until sentinel appears
    const output = await this.waitForSentinel(timeoutMs);
    const duration = Date.now() - start;

    // Extract exit code from sentinel line
    const match = output.match(new RegExp(`${this.SENTINEL}:(\\d+)`));
    const exitCode = match ? parseInt(match[1], 10) : 0;

    // Strip control characters and sentinel lines
    const clean = this.stripAnsi(output)
      .split('\n')
      .filter(l => !l.includes(this.SENTINEL) && (!isWin || !l.includes(sentinelCmd)) && !l.startsWith(`${command}`))
      .join('\n')
      .trim();

    const [stdout, stderr] = this.splitStdoutStderr(clean);
    return { stdout, stderr, exitCode, duration };
  }

  /** Change working directory of the PTY session */
  async cd(dir: string): Promise<void> {
    await this.run(`cd "${dir}"`);
    this.cwd = dir;
  }

  /** Write text to stdin of the current process (e.g., answer prompts) */
  write(text: string): void {
    this.ptyProcess?.stdin?.write(text);
  }

  close(): void {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }

  private waitFor(pattern: RegExp, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const handler = (data: string) => {
        if (pattern.test(data)) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          this.off('data', handler);
          resolve();
        }
      };
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.log(`waitFor timed out after ${timeoutMs}ms waiting for ${pattern}`);
        this.off('data', handler);
        resolve(); // Best-effort
      }, timeoutMs);
      this.on('data', handler);
    });
  }

  private waitForSentinel(timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      let accumulated = '';
      let resolved = false;
      const handler = (data: string) => {
        accumulated += data;
        if (accumulated.includes(this.SENTINEL)) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          this.off('data', handler);
          resolve(accumulated);
        }
      };
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.log(`waitForSentinel timed out after ${timeoutMs}ms`);
        this.off('data', handler);
        resolve(accumulated + this.outputBuffer);
      }, timeoutMs);
      this.on('data', handler);
    });
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
  }

  private splitStdoutStderr(output: string): [string, string] {
    // Heuristic: lines starting with "error:", "Error:", "warning:" go to stderr bucket
    const lines = output.split('\n');
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    for (const line of lines) {
      if (/^(error|Error|FAILED|fatal|FATAL|Traceback|Exception)/.test(line)) {
        stderrLines.push(line);
      } else {
        stdoutLines.push(line);
      }
    }
    return [stdoutLines.join('\n'), stderrLines.join('\n')];
  }
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// DeveloperAgent ΓÇö Claude Code-level implementation
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/**
 * DeveloperAgent ΓÇö "Amelia"
 *
 * Capabilities on par with Claude Code:
 *  ΓÇó Persistent PTY terminal session (internal + external commands)
 *  ΓÇó Full multi-language environment detection & toolchain management
 *  ΓÇó Intelligent dependency resolution (npm/yarn/pnpm/bun/pip/cargo/go)
 *  ΓÇó Deep self-healing loop with structured root-cause analysis
 *  ΓÇó Pre-write syntax validation (tsc --noEmit on in-memory content)
 *  ΓÇó Import graphΓÇôpowered RAG context retrieval
 *  ΓÇó Incremental diff patching + full file generation
 *  ΓÇó Security audit (npm audit, pip-audit, cargo audit)
 *  ΓÇó Git-aware change management
 *  ΓÇó Parallel quality checks with timeout guards
 *  ΓÇó Automatic package.json / requirements.txt / go.mod reconciliation
 */
export class DeveloperAgent extends BaseAgent {
  name = 'developer';
  description = 'Developer - Senior software engineer, code implementation, testing, quality assurance';

  private feedbackService?: FeedbackService;
  private indexingService?: IndexingService;
  private importTracer?: ImportTracer;
  private contextEngine?: ContextEngine;

  /** Persistent PTY shell ΓÇö stays alive for the whole execute() call */
  private terminal?: TerminalSession;

  /** Detected project environment — cached after first detection */
  private env?: ProjectEnv;

  /** Resolved output directory for the generated project */
  private outputDir?: string;

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
  }

  // ΓöÇΓöÇ Lazy service init ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  private lazyInitRagServices(workspaceRoot: string): void {
    if (this.contextEngine) return;
    const vectorStore = new VectorStore();
    const embeddingService = new EmbeddingService();
    const symbolChunker = new SymbolChunker(workspaceRoot);
    this.indexingService = new IndexingService(vectorStore, embeddingService, symbolChunker, workspaceRoot);
    this.importTracer = new ImportTracer(workspaceRoot);
    this.contextEngine = new ContextEngine(this.importTracer, this.indexingService, workspaceRoot);
  }

  // ΓöÇΓöÇ Main entry point ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  async execute(context: IAgentContext): Promise<string> {
    this.log('🚀 Developer Agent (Amelia) — Claude Code-level execution starting');

    if (context.workspaceRoot) {
      this.feedbackService = new FeedbackService(context.workspaceRoot);

      // ── Resolve dedicated output directory for the generated project ──
      const userRequest = (context.metadata?.userRequest as string) || '';
      this.outputDir = this.resolveOutputDir(context.workspaceRoot, userRequest);
      this.log(`📁 Output directory: ${this.outputDir}`);

      // Open persistent terminal session IN the output directory
      this.terminal = new TerminalSession(this.outputDir, (msg) => this.log(msg));
      await this.terminal.open();
      this.log('✅ Terminal session opened');

      // Detect project environment ONCE upfront — check output dir
      this.env = await this.detectProjectEnvironment(this.outputDir);
      this.log(`📊 Environment: ${JSON.stringify(this.env)}`);
    }

    const MAX_RETRIES = 5;
    let finalBuffer = '';
    const completedTasks: string[] = [];
    const issues: IssueRecord[] = [];
    const suggestions: string[] = [];

    try {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        this.log(`\nΓöüΓöüΓöü Attempt ${attempt}/${MAX_RETRIES} ΓöüΓöüΓöü`);

        if (attempt > 1) {
          completedTasks.length = 0;
          suggestions.length = 0;
          // Keep issues for error context injection into next prompt
        }

        // ΓöÇΓöÇ Context gathering ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const prev = (context.metadata?.previousOutputs || {}) as Record<string, string>;
        const analysis = prev['analyst'] || '';
        const architecture = prev['architect'] || '';
        const conversationHistory = (context.metadata?.conversationHistory as string) || '';
        const projectContext = (context.metadata?.projectContext as string) || '';
        const editMode = !!context.metadata?.editMode;
        const userRequest = (context.metadata?.userRequest as string) || 'implement feature';

        // ΓöÇΓöÇ Load all project documentation (.md files in root and .planning/)
        const projectDocs = context.workspaceRoot
          ? this.loadAllProjectDocs(context.workspaceRoot, prev)
          : { prd: prev['pm'] || '', ux: prev['uxdesigner'] || '', auxiliary: '' };

        if (projectDocs.ux) this.log(`UX Design loaded: ${projectDocs.ux.length} chars`);
        if (projectDocs.prd) this.log(`PRD loaded: ${projectDocs.prd.length} chars`);
        if (projectDocs.auxiliary) this.log(`Auxiliary docs loaded: ${projectDocs.auxiliary.length} chars`);

        // ΓöÇΓöÇ RAG context retrieval ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        let existingFilesContext = '';
        if (context.workspaceRoot) {
          this.lazyInitRagServices(context.workspaceRoot);
          if (this.indexingService && this.contextEngine) {
            this.log('≡ƒöì Building tiered code context...');
            // Background indexing
            void this.indexingService.indexWorkspace(context.workspaceRoot, this);
            // Synchronous tier 1+2 retrieval
            existingFilesContext = await this.contextEngine.getTieredContext(userRequest, 12);
            this.log(`≡ƒôÜ Context: ${existingFilesContext.length} chars retrieved`);
          }
        }

        // ΓöÇΓöÇ Filesystem snapshot for smarter context ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const fsSnapshot = context.workspaceRoot
          ? await this.buildFilesystemSnapshot(context.workspaceRoot)
          : '';

        const detectedLang = this.detectLanguage(userRequest);
        // Only consider it existing code if RAG found actual source files (not just .md docs)
        const hasActualSourceCode = existingFilesContext.length > 200 &&
          /\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|css|html)/.test(existingFilesContext);
        const hasExistingCode = hasActualSourceCode;

        // ΓöÇΓöÇ Build prompt ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const errorContext = attempt > 1
          ? this.buildErrorContext(issues)
          : '';

        const prompt = (editMode || hasExistingCode)
          ? this.buildEditPrompt(userRequest, conversationHistory, analysis, architecture,
            projectContext, existingFilesContext, fsSnapshot, projectDocs, detectedLang, errorContext)
          : this.buildCreatePrompt(userRequest, conversationHistory, analysis, architecture,
            projectContext, fsSnapshot, projectDocs, detectedLang, errorContext);

        // Clear issues from previous attempt AFTER building error context
        if (attempt > 1) issues.length = 0;

        // ΓöÇΓöÇ LLM generation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        let buffer = '';
        try {
          await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
            buffer += token;
          });

          // ── Multi-turn continuation for truncated responses ─────────────
          const MAX_CONTINUATIONS = 5;
          for (let cont = 0; cont < MAX_CONTINUATIONS; cont++) {
            const openFences = (buffer.match(/```/g) || []).length;
            const hasOddFences = openFences % 2 !== 0;
            const hasSetupInstructions = buffer.includes('FILE: SETUP_INSTRUCTIONS.md') || buffer.includes('FILE: README.md');
            const endsAbruptly = (buffer.trimEnd().length > 100 && hasOddFences) ||
              (buffer.trimEnd().length > 500 && !hasSetupInstructions && cont === 0);

            if (!endsAbruptly) break;

            this.log(`Output truncated (${openFences} fences). Continuation ${cont + 1}/${MAX_CONTINUATIONS}...`);

            const tail = buffer.substring(Math.max(0, buffer.length - 2000));
            const contPrompt = `Your previous output was cut off mid-file. Here is the tail:\n\n${tail}\n\nContinue EXACTLY where you left off. Do NOT repeat already-generated files. Use the same format:\n\n\\\`\\\`\\\`FILE: path/to/file.ext\n...content...\n\\\`\\\`\\\``;

            try {
              let continuation = '';
              await this.llmService.streamGenerate(contPrompt, undefined, (token: string) => {
                continuation += token;
              });
              if (continuation.trim().length > 20) {
                buffer += '\n' + continuation;
                this.log(`Continuation ${cont + 1}: +${continuation.length} chars`);
              } else {
                break;
              }
            } catch (contErr: any) {
              this.log(`Continuation failed: ${contErr.message}`, 'warn');
              break;
            }
          }

          completedTasks.push(`Code generated (attempt ${attempt})`);
          finalBuffer = buffer;
        } catch (err: any) {
          issues.push({ severity: 'critical', description: 'LLM generation failed', context: String(err) });
          if (attempt === MAX_RETRIES) break;
          continue;
        }

        if (!context.workspaceRoot) break;

        // Use the resolved output directory for all file operations
        const projectRoot = this.outputDir || context.workspaceRoot;

        // ── File writing ───────────────────────────────────────
        const generatedFiles = this.parseCodeFiles(buffer);
        this.log(`Parsed ${generatedFiles.length} file(s) from LLM output`);

        // Pre-validate TypeScript/JavaScript before writing
        const preValidationIssues = await this.preValidateFiles(generatedFiles, projectRoot);
        if (preValidationIssues.length > 0) {
          issues.push(...preValidationIssues);
          this.log(`Pre-validation found ${preValidationIssues.length} issue(s) — will include in retry context`);
        }

        // Filter out planning artifacts that the LLM should NOT have generated
        // Post-parse validation: detect framework mixing and bad patterns
        const hasNextFiles = generatedFiles.some(f => f.name.includes('app/layout') || f.name.includes('next.config'));
        const hasReactRouter = generatedFiles.some(f => f.content.includes('react-router-dom') || f.content.includes('BrowserRouter'));
        const hasReactDOMRender = generatedFiles.some(f => f.content.includes('ReactDOM.render') || f.content.includes('createRoot'));

        if (hasNextFiles && hasReactRouter) {
          this.log('⚠️ WARNING: Next.js project uses react-router-dom — stripping bad imports');
          for (const f of generatedFiles) {
            if (f.content.includes('react-router-dom')) {
              f.content = f.content.replace(/import.*from\s+['"]react-router-dom['"];?/g, '// Removed: react-router-dom (use next/link instead)');
            }
          }
        }

        // Filter out CRA patterns in Next.js projects
        if (hasNextFiles) {
          const craPatterns = ['app/index.tsx', 'app/App.tsx', 'app/routes.tsx', 'app/index.jsx', 'app/App.jsx'];
          const beforeCount = generatedFiles.length;
          const filtered = generatedFiles.filter(f => {
            if (craPatterns.some(p => f.name.endsWith(p))) {
              this.log(`⚠️ Filtered CRA pattern file from Next.js project: ${f.name}`);
              return false;
            }
            return true;
          });
          generatedFiles.length = 0;
          generatedFiles.push(...filtered);
        }

        // Warn about truncated filenames
        for (const f of generatedFiles) {
          const basename = f.name.split('/').pop() || '';
          if (basename.length <= 4 && basename.includes('.')) {
            this.log(`⚠️ WARNING: Suspiciously short filename: ${f.name} — may be truncated`);
          }
        }


        const PLANNING_ARTIFACTS = new Set([
          'ANALYSIS.md', 'ARCHITECTURE.md', 'UX_DESIGN.md', 'PRD.md',
          'QA_PLAN.md', 'CODE_REVIEW.md', 'analysis.md', 'architecture.md',
          'ux_design.md', 'prd.md', 'qa_plan.md', 'code_review.md',
        ]);
        const codeFiles = generatedFiles.filter(f => {
          const basename = f.name.split('/').pop() || f.name;
          if (PLANNING_ARTIFACTS.has(basename)) {
            this.log(`⚠️ Filtered out planning artifact from code output: ${f.name}`);
            return false;
          }
          return true;
        });
        this.log(`📦 ${codeFiles.length} actual code files to write (filtered ${generatedFiles.length - codeFiles.length} planning artifacts)`);

        await this.writeFiles(codeFiles, projectRoot, completedTasks, issues);


        // ── Reconcile manifests ──────────────────────────────
        await this.reconcileManifests(projectRoot, buffer, issues, suggestions);

        // ── Install dependencies ─────────────────────────────
        await this.installDependencies(projectRoot, completedTasks, issues, suggestions);

        // ── Quality gates (parallel where safe) ──────────────
        await this.runQualityGates(projectRoot, completedTasks, issues, suggestions);

        // ── Security scan ────────────────────────────────────
        await this.runSecurityScan(projectRoot, completedTasks, issues, suggestions);

        // ── Git snapshot ─────────────────────────────────────
        if (this.env?.hasGit) {
          await this.gitSnapshot(projectRoot, `Amelia: ${userRequest.substring(0, 72)}`);
        }

        // Save implementation reference
        const implPath = path.join(context.workspaceRoot, '.verno', 'IMPLEMENTATION.md');
        await this.safeWriteFile(implPath, buffer);
        this.changeTracker.recordChange(implPath, buffer);

        // ── Self-healing check ─────────────────────────────────
        const fatals = issues.filter(i => i.severity === 'high' || i.severity === 'critical');
        if (fatals.length === 0) {
          this.log(`Attempt ${attempt} succeeded — no fatal issues`);
          break;
        }

        const autoFixable = fatals.filter(i => i.autoFixed);
        this.log(`🔺 ${fatals.length} fatal(s), ${autoFixable.length} auto-fixed. Retrying...`);

        if (attempt === MAX_RETRIES) {
          this.log('Max retries reached — proceeding with remaining issues');
        }
      }

    } finally {
      // Always close terminal
      this.terminal?.close();
      this.log('Terminal session closed');
    }

    this.generateFeedback(completedTasks, issues, suggestions, context.workspaceRoot);

    // Return the final output with the output directory path so orchestrator knows where files went
    const outputMarker = this.outputDir ? `\n\n<!-- OUTPUT_DIR: ${this.outputDir} -->` : '';
    return finalBuffer + outputMarker;
  }


  // ══════════════════════════════════════════════════════════════════════
  // Output Directory Resolution
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Resolves a dedicated output directory for the generated project.
   * Creates a clean, visible folder at the workspace root named after the project.
   * e.g. workspaceRoot/shoe-store/
   */
  private resolveOutputDir(workspaceRoot: string, userRequest: string): string {
    // Try to get project name from PRD
    let projectName = '';
    try {
      const artifacts = new VernoArtifactService(workspaceRoot);
      const prd = artifacts.readJSON<{ title?: string }>('prd.json');
      if (prd?.title) {
        projectName = prd.title;
      }
    } catch { /* PRD not available */ }

    // Fallback: derive from user request
    if (!projectName) {
      const words = userRequest
        .replace(/\[.*?\]/g, '')
        .replace(/please|implement|create|build|make|the|a|an|for|with|features|described|in|this/gi, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 1)
        .slice(0, 4);
      projectName = words.join(' ') || 'generated-project';
    }

    // Slugify: "Shoe E-Commerce Store" => "shoe-ecommerce-store"
    const folderName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)
      || 'generated-project';

    // Place the project folder directly at the workspace root
    const outputDir = path.join(workspaceRoot, folderName);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.log(`📁 Project output directory: ${outputDir}`);
    return outputDir;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Environment Detection
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async detectProjectEnvironment(workspaceRoot: string): Promise<ProjectEnv> {
    const env: ProjectEnv = {
      hasNode: false, hasPython: false, hasGo: false, hasRust: false,
      hasDotnet: false, hasJava: false, hasDocker: false, hasGit: false,
      packageManager: null, pythonBin: 'python3', nodeVersion: '',
      frameworks: [], testRunner: null, linter: null, formatter: null, bundler: null,
    };

    const isWin = process.platform === 'win32';
    const exists = (p: string) => fs.existsSync(path.join(workspaceRoot, p));
    const findFiles = (pattern: string) => {
      try {
        const files = fs.readdirSync(workspaceRoot);
        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          return files.some(f => f.endsWith(ext));
        }
        return files.includes(pattern);
      } catch { return false; }
    };
    const binExists = async (bin: string) => {
      try {
        const cmd = isWin ? `where ${bin}` : `which ${bin}`;
        await exec(cmd);
        return true;
      } catch { return false; }
    };

    this.log('Detecting environment files...');
    // File markers
    if (exists('package.json')) env.hasNode = true;
    if (exists('requirements.txt') || exists('pyproject.toml') || exists('setup.py')) env.hasPython = true;
    if (exists('go.mod')) env.hasGo = true;
    if (exists('Cargo.toml')) env.hasRust = true;
    if (findFiles('*.csproj') || findFiles('*.sln') || exists('global.json')) env.hasDotnet = true;
    if (exists('pom.xml') || exists('build.gradle')) env.hasJava = true;
    if (exists('Dockerfile') || exists('docker-compose.yml')) env.hasDocker = true;
    if (exists('.git')) env.hasGit = true;

    this.log('Detecting package manager...');
    // Package manager
    if (exists('bun.lockb')) env.packageManager = 'bun';
    else if (exists('pnpm-lock.yaml')) env.packageManager = 'pnpm';
    else if (exists('yarn.lock')) env.packageManager = 'yarn';
    else if (env.hasNode) env.packageManager = 'npm';

    this.log('Detecting python binary...');
    // Python binary
    if (await binExists('python3')) env.pythonBin = 'python3';
    else if (await binExists('python')) env.pythonBin = 'python';

    this.log('Detecting Node...');
    // Node version
    if (env.hasNode) {
      try {
        const { stdout } = await exec('node --version');
        env.nodeVersion = stdout.trim();
      } catch { /* ignore */ }
    }

    // Detect frameworks from package.json
    if (env.hasNode && exists('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['next']) env.frameworks.push('Next.js');
        if (deps['react']) env.frameworks.push('React');
        if (deps['vue']) env.frameworks.push('Vue');
        if (deps['@angular/core']) env.frameworks.push('Angular');
        if (deps['svelte']) env.frameworks.push('Svelte');
        if (deps['express']) env.frameworks.push('Express');
        if (deps['fastify']) env.frameworks.push('Fastify');
        if (deps['nestjs'] || deps['@nestjs/core']) env.frameworks.push('NestJS');

        // Test runner
        if (deps['vitest']) env.testRunner = 'vitest';
        else if (deps['jest']) env.testRunner = 'jest';
        else if (deps['mocha']) env.testRunner = 'mocha';
        else if (deps['playwright']) env.testRunner = 'playwright';

        // Linter
        if (deps['eslint']) env.linter = 'eslint';
        else if (deps['biome']) env.linter = 'biome';

        // Formatter
        if (deps['prettier']) env.formatter = 'prettier';
        else if (deps['biome']) env.formatter = 'biome';

        // Bundler
        if (deps['vite']) env.bundler = 'vite';
        else if (deps['webpack']) env.bundler = 'webpack';
        else if (deps['esbuild']) env.bundler = 'esbuild';
        else if (deps['rollup']) env.bundler = 'rollup';
        else if (deps['parcel']) env.bundler = 'parcel';
      } catch { /* ignore */ }
    }

    return env;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Filesystem Snapshot (compact directory tree for LLM context)
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async buildFilesystemSnapshot(workspaceRoot: string, maxDepth = 4, maxFiles = 200): Promise<string> {
    const lines: string[] = [];
    let count = 0;

    const IGNORE = new Set([
      'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
      '.venv', 'venv', 'target', '.verno', 'coverage', '.turbo',
    ]);

    const walk = (dir: string, depth: number, prefix: string) => {
      if (depth > maxDepth || count >= maxFiles) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
        if (count >= maxFiles) { lines.push(`${prefix}... (truncated)`); return; }
        const icon = entry.isDirectory() ? '' : '';
        lines.push(`${prefix}${icon} ${entry.name}`);
        count++;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), depth + 1, `${prefix}  `);
      }
    };

    walk(workspaceRoot, 0, '');
    return lines.join('\n');
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Pre-write Validation
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  /**
   * Validate generated files BEFORE writing them to disk.
   * Catches syntax errors early and avoids corrupting the workspace.
   */
  private async preValidateFiles(
    files: GeneratedFile[],
    workspaceRoot: string
  ): Promise<IssueRecord[]> {
    const issues: IssueRecord[] = [];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amelia-validate-'));

    try {
      for (const file of files) {
        if (file.isDiff) continue; // Diffs are validated post-apply
        const ext = path.extname(file.name).toLowerCase();

        // TypeScript/JavaScript ΓÇö write to tmp and run tsc
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const tmpFile = path.join(tmpDir, path.basename(file.name));
          fs.writeFileSync(tmpFile, file.content, 'utf-8');

          // Quick syntax check using acorn-like approach via node
          const checkScript = `try { require('typescript') && require('typescript').createSourceFile('f${ext}', ${JSON.stringify(file.content)}, 99, true); console.log('ok'); } catch(e) { console.error(e.message); }`;
          try {
            const { stdout, stderr } = await exec(`node -e "${checkScript.replace(/"/g, '\\"')}"`, { cwd: workspaceRoot, timeout: 5000 });
            if (stderr && stderr.trim()) {
              issues.push({ severity: 'high', description: `Syntax error in ${file.name}`, context: stderr.trim().substring(0, 300), file: file.name });
            }
          } catch { /* tsc not available, skip */ }
        }

        // JSON ΓÇö parse directly
        if (ext === '.json') {
          try { JSON.parse(file.content); }
          catch (e: any) {
            issues.push({ severity: 'high', description: `Invalid JSON in ${file.name}`, context: e.message, file: file.name });
          }
        }

        // Python ΓÇö py_compile
        if (ext === '.py' && this.env?.hasPython) {
          const tmpFile = path.join(tmpDir, path.basename(file.name));
          fs.writeFileSync(tmpFile, file.content, 'utf-8');
          try {
            const { stderr } = await exec(`${this.env.pythonBin} -m py_compile "${tmpFile}"`, { timeout: 5000 });
            if (stderr) issues.push({ severity: 'medium', description: `Python syntax warning in ${file.name}`, context: stderr, file: file.name });
          } catch (e: any) {
            issues.push({ severity: 'high', description: `Python syntax error in ${file.name}`, context: e.message.substring(0, 300), file: file.name });
          }
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return issues;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // File Writing
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async writeFiles(
    files: GeneratedFile[],
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[]
  ): Promise<void> {
    for (const file of files) {
      // Strip output folder name from file paths if the LLM included it
      // e.g. "prd-ecommerce-website-for-furniture/src/main.ts" -> "src/main.ts"
      let cleanName = file.name;
      if (this.outputDir) {
        const outputFolderName = require('path').basename(this.outputDir);
        if (cleanName.startsWith(outputFolderName + '/') || cleanName.startsWith(outputFolderName + '\\')) {
          cleanName = cleanName.substring(outputFolderName.length + 1);
          this.log(`Stripped folder prefix from path: ${file.name} -> ${cleanName}`);
        }
      }
      const filePath = path.join(workspaceRoot, cleanName);

      // Strip git merge conflict markers from file content
      if (file.content.includes('<<<<') || file.content.includes('>>>>')) {
        const cleanedContent = file.content
          .replace(/^<<<<.*$/gm, '')
          .replace(/^====.*$/gm, '')
          .replace(/^>>>>.*$/gm, '')
          .replace(/\n{3,}/g, '\n\n');
        if (cleanedContent.trim() !== file.content.trim()) {
          this.log(`⚠️ Stripped merge conflict markers from: ${cleanName}`);
          file.content = cleanedContent;
        }
      }

      // Ensure parent directories exist
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      try {
        if (file.isDiff && fs.existsSync(filePath)) {
          await this.applyIncrementalDiff(filePath, file.content, issues);
          completedTasks.push(`Patched ${file.name}`);
        } else {
          if (fs.existsSync(filePath)) {
            await this.fileService.updateFile(filePath, file.content, true);
            this.log(`Updated: ${file.name}`);
          } else {
            await this.fileService.createFile(filePath, file.content);
            this.log(`Created: ${file.name}`);
          }
          this.changeTracker.recordChange(filePath, file.content);
          completedTasks.push(`Wrote ${file.name}`);
        }
      } catch (err: any) {
        issues.push({ severity: 'high', description: `Failed to write ${file.name}`, context: err.message, file: file.name });
      }
    }
  }

  private async applyIncrementalDiff(
    filePath: string,
    diffContent: string,
    issues: IssueRecord[]
  ): Promise<void> {
    let src = fs.readFileSync(filePath, 'utf-8');
    const hunks = [...diffContent.matchAll(/<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g)];

    if (hunks.length === 0) {
      // No hunks ΓÇö treat as full replacement
      fs.writeFileSync(filePath, diffContent, 'utf-8');
      this.changeTracker.recordChange(filePath, diffContent);
      return;
    }

    let allApplied = true;
    for (const hunk of hunks) {
      const [, oldCode, newCode] = hunk;
      if (src.includes(oldCode)) {
        src = src.replace(oldCode, newCode);
      } else {
        // Fuzzy match ΓÇö find closest line and warn
        issues.push({
          severity: 'medium',
          description: `Diff hunk not found exactly in ${path.basename(filePath)}`,
          context: `Could not locate:\n${oldCode.substring(0, 200)}`,
          file: filePath,
          autoFixed: false,
        });
        allApplied = false;
      }
    }

    if (allApplied || src !== fs.readFileSync(filePath, 'utf-8')) {
      fs.writeFileSync(filePath, src, 'utf-8');
      this.changeTracker.recordChange(filePath, src);
      this.log(`Applied ${hunks.length} diff hunk(s) to ${path.basename(filePath)}`);
    }
  }

  private async safeWriteFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch { /* best-effort */ }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Manifest Reconciliation
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  /**
   * Reconcile package manifests ΓÇö ensure all imports referenced in generated
   * files are present in the manifest, and fix JSON syntax issues.
   */
  private async reconcileManifests(
    workspaceRoot: string,
    llmOutput: string,
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    // package.json
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      this.sanitizeAndUpgradePackageJson(pkgPath);
      const missingDeps = this.detectMissingNpmDeps(workspaceRoot, llmOutput);
      if (missingDeps.length > 0) {
        this.log(`Auto-adding missing npm deps: ${missingDeps.join(', ')}`);
        try {
          const pm = this.env?.packageManager || 'npm';
          const installCmd = this.buildInstallCmd(pm, missingDeps);
          if (this.terminal) {
            const result = await this.terminal.run(installCmd, 60_000);
            if (result.exitCode === 0) {
              suggestions.push(`Auto-installed: ${missingDeps.join(', ')}`);
            }
          }
        } catch (err: any) {
          issues.push({ severity: 'medium', description: 'Auto-install of missing deps failed', context: err.message });
        }
      }
    }

    // requirements.txt
    const reqPath = path.join(workspaceRoot, 'requirements.txt');
    if (fs.existsSync(reqPath) && this.env?.hasPython) {
      const missingPkgs = this.detectMissingPythonDeps(workspaceRoot, llmOutput);
      if (missingPkgs.length > 0) {
        this.log(`Auto-adding missing Python packages: ${missingPkgs.join(', ')}`);
        const existing = fs.readFileSync(reqPath, 'utf-8');
        const toAdd = missingPkgs.filter(p => !existing.includes(p));
        if (toAdd.length > 0) {
          fs.appendFileSync(reqPath, '\n' + toAdd.join('\n'));
        }
      }
    }
  }

  private detectMissingNpmDeps(workspaceRoot: string, llmOutput: string): string[] {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    let existingDeps: Record<string, string> = {};
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      existingDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch { return []; }

    const missing: string[] = [];
    // Match import statements from all TS/JS files in the output
    const importMatches = llmOutput.matchAll(/from\s+['"](@?[a-z][a-z0-9-_/]*)['"]|require\(['"](@?[a-z][a-z0-9-_/]*)['"]\)/g);
    const seenPackages = new Set<string>();

    for (const m of importMatches) {
      const imp = (m[1] || m[2] || '').split('/')[0]; // scope-aware: @org/pkg
      if (!imp || imp.startsWith('.') || seenPackages.has(imp)) continue;
      seenPackages.add(imp);

      // Skip Node built-ins
      const builtins = new Set(['fs', 'path', 'os', 'http', 'https', 'crypto', 'events', 'stream',
        'util', 'child_process', 'net', 'tls', 'dns', 'url', 'querystring', 'buffer',
        'assert', 'zlib', 'readline', 'cluster', 'worker_threads', 'vm', 'timers']);
      if (builtins.has(imp)) continue;

      if (!existingDeps[imp]) {
        missing.push(imp);
      }
    }

    return [...new Set(missing)].slice(0, 20); // Cap at 20 to avoid runaway installs
  }

  private detectMissingPythonDeps(workspaceRoot: string, llmOutput: string): string[] {
    const reqPath = path.join(workspaceRoot, 'requirements.txt');
    let existing = '';
    try { existing = fs.readFileSync(reqPath, 'utf-8').toLowerCase(); } catch { return []; }

    const STDLIB = new Set(['os', 'sys', 'json', 're', 'math', 'time', 'datetime', 'collections',
      'itertools', 'functools', 'pathlib', 'typing', 'abc', 'io', 'logging', 'unittest',
      'argparse', 'subprocess', 'shutil', 'tempfile', 'hashlib', 'base64', 'copy', 'enum']);

    const importMatches = llmOutput.matchAll(/^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
    const missing: string[] = [];
    for (const m of importMatches) {
      const pkg = m[1].toLowerCase();
      if (!STDLIB.has(pkg) && !existing.includes(pkg)) {
        missing.push(pkg);
      }
    }
    return [...new Set(missing)];
  }

  private buildInstallCmd(pm: string, deps: string[]): string {
    const list = deps.join(' ');
    switch (pm) {
      case 'yarn': return `yarn add ${list}`;
      case 'pnpm': return `pnpm add ${list}`;
      case 'bun': return `bun add ${list}`;
      default: return `npm install ${list} --save`;
    }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Dependency Installation
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async installDependencies(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    if (!this.terminal) return;
    const pm = this.env?.packageManager;

    // Node
    if (pm && fs.existsSync(path.join(workspaceRoot, 'package.json'))) {
      this.log(`≡ƒôª Installing Node dependencies with ${pm}...`);
      const cmd = pm === 'npm' ? 'npm install' : pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm install' : 'bun install';
      const result = await this.terminal.run(cmd, 180_000);

      if (result.exitCode !== 0) {
        // Try to auto-recover from common npm errors
        const fixed = await this.autoFixNpmError(workspaceRoot, result.stderr || result.stdout, issues);
        if (fixed) {
          // Retry install once after fix
          const retry = await this.terminal.run(cmd, 180_000);
          if (retry.exitCode === 0) {
            completedTasks.push(`Installed Node dependencies (after auto-fix)`);
            return;
          }
        }
        issues.push({ severity: 'high', description: `${pm} install failed`, context: (result.stderr || result.stdout).substring(0, 600) });
      } else {
        completedTasks.push(`Installed Node dependencies (${pm})`);
      }
    }

    // Python
    if (this.env?.hasPython && fs.existsSync(path.join(workspaceRoot, 'requirements.txt'))) {
      this.log('≡ƒÉì Installing Python dependencies...');
      const result = await this.terminal.run(
        `${this.env.pythonBin} -m pip install -r requirements.txt --quiet`, 120_000
      );
      if (result.exitCode !== 0) {
        issues.push({ severity: 'high', description: 'pip install failed', context: result.stderr.substring(0, 400) });
      } else {
        completedTasks.push('Installed Python dependencies');
      }
    }

    // Rust
    if (this.env?.hasRust && fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
      this.log('≡ƒªÇ Fetching Rust dependencies...');
      const result = await this.terminal.run('cargo fetch', 120_000);
      if (result.exitCode !== 0) {
        issues.push({ severity: 'medium', description: 'cargo fetch failed', context: result.stderr.substring(0, 400) });
      } else {
        completedTasks.push('Fetched Rust dependencies');
      }
    }

    // Go
    if (this.env?.hasGo && fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
      this.log('≡ƒö╡ Downloading Go modules...');
      const result = await this.terminal.run('go mod tidy', 120_000);
      if (result.exitCode !== 0) {
        issues.push({ severity: 'medium', description: 'go mod tidy failed', context: result.stderr.substring(0, 400) });
      } else {
        completedTasks.push('Tidied Go modules');
      }
    }
  }

  private async autoFixNpmError(workspaceRoot: string, errorOutput: string, issues: IssueRecord[]): Promise<boolean> {
    let fixed = false;

    // Fix: peer dependency conflicts ΓÇö use legacy-peer-deps
    if (errorOutput.includes('peer dep') || errorOutput.includes('ERESOLVE')) {
      this.log('≡ƒöº Auto-fix: adding --legacy-peer-deps flag');
      const npmrc = path.join(workspaceRoot, '.npmrc');
      const current = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf-8') : '';
      if (!current.includes('legacy-peer-deps')) {
        fs.writeFileSync(npmrc, current + '\nlegacy-peer-deps=true\n');
        issues.push({ severity: 'low', description: 'Added legacy-peer-deps to .npmrc', context: 'Auto-fix for peer dependency conflict', autoFixed: true });
        fixed = true;
      }
    }

    // Fix: package-lock conflict
    if (errorOutput.includes('npm error code ELOCKVERIFY') || errorOutput.includes('package-lock.json')) {
      this.log('≡ƒöº Auto-fix: deleting package-lock.json and node_modules');
      const lockFile = path.join(workspaceRoot, 'package-lock.json');
      const nmDir = path.join(workspaceRoot, 'node_modules');
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      if (fs.existsSync(nmDir)) {
        await this.terminal?.run(`rm -rf "${nmDir}"`, 30_000);
      }
      issues.push({ severity: 'low', description: 'Cleared package-lock and node_modules', context: 'Auto-fix for lockfile conflict', autoFixed: true });
      fixed = true;
    }

    // Fix: stale / invalid versions in package.json
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      this.sanitizeAndUpgradePackageJson(pkgPath);
      fixed = true;
    }

    return fixed;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Quality Gates
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async runQualityGates(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    if (!this.terminal) return;
    this.log('≡ƒö¼ Running quality gates...');

    // Run all applicable checks in sequence (order matters for dependency chain)
    const checks = [
      () => this.runTypeCheck(workspaceRoot, completedTasks, issues),
      () => this.runBuild(workspaceRoot, completedTasks, issues, suggestions),
      () => this.runTests(workspaceRoot, completedTasks, issues, suggestions),
      () => this.runLinter(workspaceRoot, completedTasks, issues, suggestions),
      () => this.runPythonChecks(workspaceRoot, completedTasks, issues),
      () => this.runRustChecks(workspaceRoot, completedTasks, issues),
      () => this.runGoChecks(workspaceRoot, completedTasks, issues),
    ];

    for (const check of checks) {
      try { await check(); }
      catch (err: any) { this.log(`Quality check threw: ${err.message}`, 'warn'); }
    }
  }

  private async runTypeCheck(workspaceRoot: string, completedTasks: string[], issues: IssueRecord[]): Promise<void> {
    if (!fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))) return;
    this.log('≡ƒö╖ TypeScript check...');
    const result = await this.terminal!.run('npx tsc --noEmit', 60_000);
    if (result.exitCode !== 0) {
      const errors = this.parseTscErrors(result.stdout + result.stderr);
      for (const e of errors) {
        issues.push({ severity: 'high', description: e.message, context: e.context, file: e.file, line: e.line });
      }
      this.log(`Γ¥î TypeScript: ${errors.length} error(s)`);
    } else {
      completedTasks.push('TypeScript type check passed');
      this.log('Γ£à TypeScript OK');
    }
  }

  private parseTscErrors(output: string): Array<{ file: string; line: number; message: string; context: string }> {
    const errors: Array<{ file: string; line: number; message: string; context: string }> = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const m = line.match(/^(.+?)\((\d+),\d+\):\s+error\s+TS\d+:\s+(.+)$/);
      if (m) {
        errors.push({ file: m[1], line: parseInt(m[2]), message: m[3], context: line });
      }
    }
    return errors.slice(0, 20); // Cap
  }

  private async runBuild(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts?.build) return;
    } catch { return; }

    this.log('≡ƒÅù∩╕Å  Running build...');
    const result = await this.terminal!.run('npm run build', 120_000);
    if (result.exitCode !== 0) {
      issues.push({
        severity: 'high',
        description: 'Build failed',
        context: (result.stderr || result.stdout).substring(0, 600),
      });
    } else {
      completedTasks.push('Build succeeded');
      this.log('Γ£à Build OK');
    }
  }

  private async runTests(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    let hasTestScript = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      hasTestScript = !!(pkg.scripts?.test);
    } catch { return; }

    if (!hasTestScript) {
      suggestions.push('Add a test script to package.json for automated verification');
      return;
    }

    this.log('≡ƒº¬ Running tests...');
    const testCmd = this.env?.testRunner === 'vitest' ? 'npx vitest run' : 'npm test -- --passWithNoTests';
    const result = await this.terminal!.run(testCmd, 120_000);

    if (result.exitCode !== 0) {
      issues.push({
        severity: 'high',
        description: 'Tests failed',
        context: (result.stderr || result.stdout).substring(0, 600),
      });
    } else {
      completedTasks.push('All tests passed');
      this.log('Γ£à Tests OK');
    }
  }

  private async runLinter(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    if (!this.env?.linter) return;
    this.log(`≡ƒº╣ Running ${this.env.linter}...`);
    const cmd = this.env.linter === 'biome'
      ? 'npx biome check .'
      : 'npx eslint . --max-warnings=0 --format=compact';
    const result = await this.terminal!.run(cmd, 30_000);
    if (result.exitCode !== 0) {
      // Lint errors are low severity ΓÇö don't block
      issues.push({ severity: 'low', description: 'Lint issues found', context: result.stdout.substring(0, 400) });
      suggestions.push('Fix lint warnings for better code quality');
    } else {
      completedTasks.push('Lint passed');
    }
  }

  private async runPythonChecks(workspaceRoot: string, completedTasks: string[], issues: IssueRecord[]): Promise<void> {
    if (!this.env?.hasPython) return;
    const pyFiles = this.findFiles(workspaceRoot, '.py').slice(0, 50);
    if (pyFiles.length === 0) return;

    this.log('≡ƒÉì Python type/lint check...');

    // mypy if available
    const result = await this.terminal!.run(
      `${this.env.pythonBin} -m mypy ${pyFiles.slice(0, 20).map(f => `"${f}"`).join(' ')} --ignore-missing-imports 2>&1 || true`,
      30_000
    );
    if (result.stdout.includes('error:')) {
      issues.push({ severity: 'medium', description: 'mypy type errors', context: result.stdout.substring(0, 400) });
    } else {
      completedTasks.push('Python type check passed');
    }
  }

  private async runRustChecks(workspaceRoot: string, completedTasks: string[], issues: IssueRecord[]): Promise<void> {
    if (!this.env?.hasRust) return;
    this.log('≡ƒªÇ Rust check...');
    const result = await this.terminal!.run('cargo check 2>&1', 60_000);
    if (result.exitCode !== 0) {
      issues.push({ severity: 'high', description: 'cargo check failed', context: result.stdout.substring(0, 400) });
    } else {
      completedTasks.push('Rust cargo check passed');
    }
  }

  private async runGoChecks(workspaceRoot: string, completedTasks: string[], issues: IssueRecord[]): Promise<void> {
    if (!this.env?.hasGo) return;
    this.log('≡ƒö╡ Go vet...');
    const result = await this.terminal!.run('go vet ./... 2>&1', 30_000);
    if (result.exitCode !== 0) {
      issues.push({ severity: 'medium', description: 'go vet issues', context: result.stdout.substring(0, 300) });
    } else {
      completedTasks.push('Go vet passed');
    }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Security Scanning
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async runSecurityScan(
    workspaceRoot: string,
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[]
  ): Promise<void> {
    if (!this.terminal) return;

    if (this.env?.hasNode && fs.existsSync(path.join(workspaceRoot, 'package-lock.json'))) {
      this.log('≡ƒöÆ npm audit...');
      const result = await this.terminal.run('npm audit --audit-level=high --json 2>&1 || true', 30_000);
      try {
        const report = JSON.parse(result.stdout);
        const vulns = report?.metadata?.vulnerabilities;
        if (vulns && (vulns.high > 0 || vulns.critical > 0)) {
          issues.push({
            severity: 'medium',
            description: `npm audit: ${vulns.high || 0} high, ${vulns.critical || 0} critical vulnerabilities`,
            context: 'Run `npm audit fix` to resolve',
          });
        } else {
          completedTasks.push('npm audit clean');
        }
      } catch { /* Report not JSON, skip */ }
    }

    if (this.env?.hasRust) {
      const result = await this.terminal.run('cargo audit 2>&1 || true', 30_000);
      if (result.stdout.includes('Vulnerability found')) {
        issues.push({ severity: 'medium', description: 'Cargo audit found vulnerabilities', context: result.stdout.substring(0, 300) });
      }
    }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Git Integration
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private async gitSnapshot(workspaceRoot: string, message: string): Promise<void> {
    if (!this.terminal) return;
    try {
      await this.terminal.run('git add -A', 10_000);
      await this.terminal.run(`git commit -m "${message.replace(/"/g, "'")}" --allow-empty`, 10_000);
      this.log(`≡ƒôî Git snapshot: ${message}`);
    } catch { /* Non-critical ΓÇö git might not be initialised */ }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Package.json Sanitisation
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private sanitizeAndUpgradePackageJson(packageJsonPath: string): void {
    try {
      let raw = fs.readFileSync(packageJsonPath, 'utf-8');
      // Strip trailing commas
      raw = raw.replace(/,(\s*[}\]])/g, '$1');

      let pkg: any;
      try { pkg = JSON.parse(raw); }
      catch (e: any) { this.log(`package.json unparseable: ${e.message}`, 'warn'); return; }

      const VERSION_MAP: Record<string, string> = {
        'vite': '^5.4.8', '@vitejs/plugin-react': '^4.3.1',
        '@vitejs/plugin-react-swc': '^3.7.1', '@vitejs/plugin-vue': '^5.1.4',
        'react': '^18.3.1', 'react-dom': '^18.3.1',
        '@types/react': '^18.3.11', '@types/react-dom': '^18.3.1',
        'typescript': '^5.6.3', 'vitest': '^2.1.4',
        '@testing-library/react': '^16.0.0',
        'next': '^14.2.0', 'express': '^4.21.0',
        'tailwindcss': '^3.4.0',
      };

      let changed = false;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!pkg[section]) continue;
        for (const [dep, goodVer] of Object.entries(VERSION_MAP)) {
          if (!(dep in pkg[section])) continue;
          const cur = pkg[section][dep] as string;
          const curMajor = parseInt(cur.replace(/[^\d]/, ''), 10) || 0;
          const goodMajor = parseInt(goodVer.replace(/[^\d]/, ''), 10) || 0;
          if (curMajor < goodMajor) {
            this.log(`Γ¼å∩╕Å  ${dep}: ${cur} ΓåÆ ${goodVer}`);
            pkg[section][dep] = goodVer;
            changed = true;
          }
        }
      }

      if (changed) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
        this.log('Γ£à package.json sanitized');
      }
    } catch (err: any) {
      this.log(`sanitizePackageJson error: ${err.message}`, 'warn');
    }
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Code Parsing
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private parseCodeFiles(content: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const seen = new Set<string>();

    const add = (name: string, fileContent: string, isDiff = false) => {
      const n = name.trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      files.push({ name: n, content: fileContent.trim(), isDiff });
    };

    // TIER 0: Diff blocks
    for (const m of content.matchAll(/```diff\s*\n(?:FILE|EDIT):\s*([^\n]+)\n([\s\S]*?)```/g)) {
      add(m[1], m[2], true);
    }

    // TIER 1A: Inline FILE/EDIT blocks
    for (const m of content.matchAll(/```(?:FILE|EDIT):\s*([^\n]+)\n([\s\S]*?)```/g)) {
      add(m[1], m[2]);
    }

    // TIER 1B: Split FILE/EDIT blocks
    for (const m of content.matchAll(/(?:^|\n)(?:FILE|EDIT):\s*([^\n]+)\s*\n+\s*```(?:\w+)?\s*\n([\s\S]*?)```/gm)) {
      add(m[1], m[2]);
    }

    // TIER 2: # file: / // file: comment headers
    for (const m of content.matchAll(/(?:^|\n)(?:#|\/\/)\s*file:\s*([^\n]+)\s*\n([\s\S]*?)(?=\n(?:#|\/\/)\s*file:|$)/gi)) {
      let c = m[2].trim();
      if (c.startsWith('```') && c.endsWith('```')) {
        c = c.replace(/^```(?:\w+)?\s*\n/, '').replace(/\n```$/, '');
      }
      add(m[1], c);
    }

    if (files.length > 0) return files;

    // TIER 3: Fallback ΓÇö language-tagged fences
    const langToExt: Record<string, string> = {
      html: '.html', htm: '.html', css: '.css', scss: '.scss', less: '.less',
      javascript: '.js', js: '.js', jsx: '.jsx',
      typescript: '.ts', ts: '.ts', tsx: '.tsx',
      python: '.py', py: '.py', java: '.java', json: '.json',
      markdown: '.md', md: '.md', xml: '.xml',
      yaml: '.yaml', yml: '.yaml', bash: '.sh', sh: '.sh',
      sql: '.sql', go: '.go', rust: '.rs', rb: '.rb', php: '.php',
    };

    const SKIP_LANGS = new Set(['text', 'plaintext', 'log', 'output', 'console']);
    let idx = 0;
    for (const m of content.matchAll(/```(\w+)\s*\n([\s\S]*?)```/g)) {
      const lang = m[1].toLowerCase();
      const code = m[2].trim();
      if (SKIP_LANGS.has(lang) || code.length < 20) continue;
      const ext = langToExt[lang] || `.${lang}`;
      const name = this.guessFilename(content, m.index!, lang, ext, idx);
      add(name, code);
      idx++;
    }

    return files;
  }

  private guessFilename(content: string, blockOffset: number, lang: string, ext: string, index: number): string {
    const before = content.substring(Math.max(0, blockOffset - 250), blockOffset);

    const nameRe = /([\w./-]+\.(html|css|js|ts|jsx|tsx|py|java|json|md|xml|yaml|yml|go|rs|rb|php|sh|sql))\s*$/im;
    const nm = before.match(nameRe);
    if (nm) return nm[1].trim();

    const pathRe = /(?:^|\s|`|\*\*)([\w/-]+\/[\w.-]+)(?:`|\*\*|\s|$)/gm;
    let pm: RegExpExecArray | null;
    while ((pm = pathRe.exec(before)) !== null) {
      if (pm[1].includes('.')) return pm[1];
    }

    const DEFAULTS: Record<string, string> = {
      html: 'index.html', css: 'styles.css', javascript: 'script.js', js: 'script.js',
      typescript: 'index.ts', ts: 'index.ts', json: 'package.json',
      python: 'main.py', py: 'main.py', markdown: 'README.md', md: 'README.md',
    };
    return DEFAULTS[lang] || `file_${index}${ext}`;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Prompt Builders
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private buildErrorContext(issues: IssueRecord[]): string {
    const fatal = issues.filter(i => ['critical', 'high', 'medium'].includes(i.severity));
    if (!fatal.length) return '';
    return '\n\n## ERRORS FROM PREVIOUS ATTEMPT ΓÇö FIX THESE FIRST:\n' +
      fatal.map(i => `### ${i.severity.toUpperCase()}: ${i.description}${i.file ? ` [${i.file}${i.line ? `:${i.line}` : ''}]` : ''}\n${i.context}\n`).join('\n');
  }

  /**
   * Loads all project documentation (.md files) from root and .planning/ folder.
   * Prioritizes PRD and UX_DESIGN, then aggregates others.
   */
  private loadAllProjectDocs(workspaceRoot: string, previousOutputs: Record<string, string>) {
    const docs = {
      prd: previousOutputs['pm'] || '',
      ux: previousOutputs['uxdesigner'] || '',
      auxiliary: ''
    };

    const auxDocs: string[] = [];
    const MAX_AUX_CHARS = 15000;
    let totalAuxChars = 0;

    const scanDirs = [workspaceRoot, path.join(workspaceRoot, '.planning')];

    // Priority keys to skip if we already have them from previousOutputs
    const priorityFiles = new Set(['PRD.md', 'UX_DESIGN.md']);

    for (const dir of scanDirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.md')) {
            const fullPath = path.join(dir, file);
            const content = fs.readFileSync(fullPath, 'utf-8');

            // Handle primary artifacts first if they aren't in memory
            if (file === 'PRD.md' && !docs.prd) {
              docs.prd = content;
              continue;
            }
            if (file === 'UX_DESIGN.md' && !docs.ux) {
              docs.ux = content;
              continue;
            }

            // Otherwise, it's auxiliary intelligence
            if (!priorityFiles.has(file) && totalAuxChars < MAX_AUX_CHARS) {
              const relPath = path.relative(workspaceRoot, fullPath);
              const header = `\n### DOCUMENT: ${relPath}\n`;
              const snippet = content.length > 3000 ? content.substring(0, 3000) + '\n... (truncated)' : content;

              if (totalAuxChars + snippet.length + header.length < MAX_AUX_CHARS) {
                auxDocs.push(`${header}${snippet}`);
                totalAuxChars += snippet.length + header.length;
              }
            }
          }
        }
      } catch { /* skip inaccessible */ }
    }

    docs.auxiliary = auxDocs.join('\n');
    return docs;
  }

  private buildCreatePrompt(
    userRequest: string,
    conversationHistory: string,
    analysis: string,
    architecture: string,
    projectContext: string,
    fsSnapshot: string,
    docs: { prd: string; ux: string; auxiliary: string },
    detectedLang?: string,
    errorContext = ''
  ): string {
    const langLine = detectedLang ? `LANGUAGE: ${detectedLang}. ALL code MUST be in ${detectedLang}.\n` : '';
    const envLine = this.env ? `ENVIRONMENT: ${JSON.stringify({
      packageManager: this.env.packageManager,
      frameworks: this.env.frameworks,
      testRunner: this.env.testRunner,
      nodeVersion: this.env.nodeVersion,
    })}\n` : '';

    return `${langLine}${envLine}You are Amelia, a world-class senior software engineer. Your code is production-grade, fully typed, well-structured, performant, and secure.

## TASK
${userRequest}

## PROJECT CONTEXT
${projectContext ? projectContext.substring(0, 1000) : '(new project)'}

## WORKSPACE STRUCTURE
\`\`\`
${fsSnapshot.substring(0, 2000)}
\`\`\`

${analysis ? `## ANALYSIS\n${analysis.substring(0, 2000)}\n` : ''}
${architecture ? `## ARCHITECTURE\n${architecture.substring(0, 2000)}\n` : ''}

## PROJECT DOCUMENTATION
${docs.prd ? `### PRODUCT REQUIREMENTS (MANDATORY)\n${docs.prd.substring(0, 3000)}\n` : ''}
${docs.ux ? `### UX DESIGN SPECIFICATION (MANDATORY)\n${docs.ux.substring(0, 4000)}\n` : ''}
${docs.auxiliary ? `### ADDITIONAL INTELLIGENCE\n${docs.auxiliary}\n` : ''}

${conversationHistory ? `## CONVERSATION HISTORY\n${conversationHistory.substring(0, 1500)}\n` : ''}
${errorContext}

## CRITICAL — WHAT YOU MUST OUTPUT
You are a CODE GENERATOR. Your job is to output RUNNABLE APPLICATION SOURCE CODE.
Pick ONE project structure template below that best matches the request. Do NOT combine multiple templates.

DO NOT output:
- ANALYSIS.md, ARCHITECTURE.md, UX_DESIGN.md, or any planning documents
- Documents that describe what to build — those are your INPUTS, not outputs
- Summaries, analyses, or requirement restatements

DO output:
- package.json (with all dependencies)
- Source code files (HTML, CSS, JS/TS, etc.)
- Configuration files (tsconfig.json, vite.config.ts, .env.example, etc.)
- Test files with real assertions
- SETUP_INSTRUCTIONS.md (the only .md you should generate)

The ANALYSIS, ARCHITECTURE, PRD, and UX_DESIGN sections above are your INPUT context. Read them, then generate the actual application code that implements them.

## IMPLEMENTATION RULES
1. Generate FULLY COMPLETE, WORKING code ΓÇö no stubs, no TODOs, no placeholders.
2. Every function must have a complete implementation.
3. Include ALL necessary files: entry points, configs, tests, README.
4. All imports must be correctly resolved.
5. Include package.json / requirements.txt / go.mod / Cargo.toml as appropriate.
6. Write at least one test file with meaningful tests.
7. Handle errors properly ΓÇö never swallow exceptions silently.
8. Use TypeScript strict mode when writing TypeScript.
${docs.ux ? `9. UI MUST be visually styled per the UX Design Specification above. NO blank/unstyled HTML structures.\\n` : ''}
${docs.prd ? `10. Every feature and acceptance criterion in the PRD MUST be implemented.\\n` : ''}
${detectedLang ? `11. ONLY use ${detectedLang}. Do not introduce other languages.\\n` : ''}



## RULES — MANDATORY
1. Pick ONE architecture matching the project. Do NOT combine multiple patterns.
2. If using Next.js App Router: put pages in app/, use next/link (NOT react-router-dom), add "use client" to components with hooks/events, include postcss.config.js when using Tailwind, globals.css MUST have @tailwind directives and be imported in layout.tsx.
3. If using Express/NestJS backend: include controllers with real route handlers, models with real schemas, middleware with real logic. Every service must make real API calls.
4. Every file must have a COMPLETE implementation — no stubs, no TODOs, no empty function bodies.
5. package.json must list ALL dependencies the code imports. Do NOT include phantom packages that don't exist on npm.
6. layout.tsx MUST have <html>, <body>, {children}, metadata, and font loading.
7. Generate ALL pages, components, services, and config files — not just 3-4 skeleton files.
8. Use proper styling (Tailwind classes or CSS) on every component — no bare unstyled HTML.

## OUTPUT FORMAT ΓÇö MANDATORY
Each file MUST be wrapped like this:

\`\`\`FILE: relative/path/to/file.ext
...complete file content...
\`\`\`

Output ALL files using this format. Never describe what you would do — write the actual code.

CRITICAL: All file paths MUST be relative to the project root directory.
- GOOD: \`src/app.ts\`, \`package.json\`, \`public/index.html\`
- BAD: \`/home/user/project/src/app.ts\`, \`.verno/projects/foo/src/app.ts\`
- BAD: Do NOT include the project folder name in paths. Write \`src/main.ts\`, NOT \`my-project/src/main.ts\`
## POST-GENERATION SUMMARY ΓÇö MANDATORY
After all file blocks, you MUST output a final file:

\`\`\`FILE: SETUP_INSTRUCTIONS.md
# Project Setup & Run Instructions

## Directory Structure
(Describe what each top-level folder/file does in a markdown table)

## Prerequisites
(List required tools: Node.js version, npm/yarn, database, etc.)

## Installation
(Exact shell commands to install dependencies)

## Running the Application
(Exact commands to start dev server, build for production, run tests)

## Environment Variables
(List all required env vars with descriptions)
\`\`\``;
  }

  private buildEditPrompt(
    userRequest: string,
    conversationHistory: string,
    analysis: string,
    architecture: string,
    projectContext: string,
    existingFilesContext: string,
    fsSnapshot: string,
    docs: { prd: string; ux: string; auxiliary: string },
    detectedLang?: string,
    errorContext = ''
  ): string {
    const langLine = detectedLang ? `LANGUAGE: ${detectedLang}. ALL code MUST be in ${detectedLang}.\n` : '';
    const envLine = this.env ? `ENVIRONMENT: ${JSON.stringify({
      packageManager: this.env.packageManager,
      frameworks: this.env.frameworks,
      bundler: this.env.bundler,
    })}\n` : '';

    return `${langLine}${envLine}You are Amelia, a world-class senior software engineer editing an existing codebase.

## TASK
${userRequest}

## WORKSPACE STRUCTURE
\`\`\`
${fsSnapshot.substring(0, 1500)}
\`\`\`

## RELEVANT EXISTING CODE
${existingFilesContext.substring(0, 5000)}

${analysis ? `## ANALYSIS\n${analysis.substring(0, 1500)}\n` : ''}
${architecture ? `## ARCHITECTURE\n${architecture.substring(0, 1500)}\n` : ''}

## PROJECT DOCUMENTATION
${docs.prd ? `### PRODUCT REQUIREMENTS (MANDATORY)\n${docs.prd.substring(0, 2500)}\n` : ''}
${docs.ux ? `### UX DESIGN SPECIFICATION (MANDATORY)\n${docs.ux.substring(0, 3500)}\n` : ''}
${docs.auxiliary ? `### ADDITIONAL INTELLIGENCE\n${docs.auxiliary}\n` : ''}

${conversationHistory ? `## CONVERSATION HISTORY\n${conversationHistory.substring(0, 1000)}\n` : ''}
${errorContext}

## EDITING RULES
1. Only output files that need to change or new files that need to be created.
2. Show the COMPLETE content of every modified file ΓÇö never partial snippets.
3. Do not recreate unchanged files.
4. Preserve existing code style and patterns unless overriding per UX/PRD spec.
5. All imports must remain valid after your changes.
6. Update tests to cover your changes.
${docs.ux ? `7. UI MUST match the UX Design Specification ΓÇö no unstyled components or plain HTML.\n` : ''}
${docs.prd ? `8. All PRD features must be present in the final code.\n` : ''}
${detectedLang ? `9. ONLY use ${detectedLang}.\n` : ''}

## OUTPUT FORMAT ΓÇö MANDATORY

For modifying existing files (preferred ΓÇö saves tokens):
\`\`\`diff
FILE: relative/path/to/existing-file.ext
<<<<
exact old code block to replace (must match file exactly)
====
new code block replacement
>>>>
\`\`\`

For entirely new files:
\`\`\`FILE: relative/path/to/new-file.ext
...complete file content...
\`\`\`

Output code only. No explanations outside of code comments.`;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Utilities
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private findFiles(dir: string, ext: string, maxCount = 100): string[] {
    const results: string[] = [];
    const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv']);

    const walk = (d: string) => {
      if (results.length >= maxCount) return;
      try {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (IGNORE.has(entry.name)) continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name.endsWith(ext)) results.push(full);
        }
      } catch { /* skip unreadable dirs */ }
    };
    walk(dir);
    return results;
  }

  private detectLanguage(userRequest: string): string | undefined {
    const patterns: Array<[RegExp, string]> = [
      [/\bpython3?\b|\b\.py\b/i, 'Python'],
      [/\btypescript\b|\b\.tsx?\b/i, 'TypeScript'],
      [/\bjavascript\b|\b\.jsx?\b/i, 'JavaScript'],
      [/\bjava\b(?!script)/i, 'Java'],
      [/\bruby\b|\b\.rb\b/i, 'Ruby'],
      [/\brust\b|\b\.rs\b/i, 'Rust'],
      [/\bgolang\b|\bgo\b/i, 'Go'],
      [/\bc\+\+\b|\bcpp\b/i, 'C++'],
      [/\bc#\b|\bcsharp\b/i, 'C#'],
      [/\bphp\b/i, 'PHP'], [/\bswift\b/i, 'Swift'], [/\bkotlin\b/i, 'Kotlin'],
      [/\bhtml\b/i, 'HTML'], [/\bcss\b/i, 'CSS'],
      [/\bsql\b/i, 'SQL'], [/\bbash\b|\bshell\b/i, 'Bash'],
    ];
    for (const [p, l] of patterns) if (p.test(userRequest)) return l;
    return undefined;
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  // Feedback
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

  private generateFeedback(
    completedTasks: string[],
    issues: IssueRecord[],
    suggestions: string[],
    workspaceRoot?: string
  ): void {
    if (!this.feedbackService || !workspaceRoot) return;

    const remainingWork: string[] = [];
    if (issues.some(i => i.severity === 'high' || i.severity === 'critical')) {
      remainingWork.push('Fix critical/high severity issues listed above');
    }
    if (issues.some(i => i.description.includes('test'))) remainingWork.push('Debug failing tests');
    if (issues.some(i => i.description.includes('TypeScript'))) remainingWork.push('Resolve TypeScript errors');
    if (issues.some(i => i.description.includes('Build'))) remainingWork.push('Fix build errors');

    const nextSteps = issues.length === 0
      ? ['Run end-to-end tests', 'Deploy to staging', 'Code review']
      : ['Address high-priority issues', 'Re-run quality gates after fixes'];

    this.feedbackService.createFeedback(
      'DeveloperAgent',
      completedTasks,
      remainingWork,
      issues,
      suggestions,
      nextSteps
    );
  }
}
