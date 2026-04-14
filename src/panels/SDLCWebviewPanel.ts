import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DebateOrchestrator } from '../agents/DebateOrchestrator';
import { LLMService } from '../services/llm';
import { Logger } from '../utils/logger';
import { DebateMessage, PRDDocument, Epic, SyncStatus } from '../types/sdlc';
import { JiraAuthService } from '../jira/JiraAuthService';
import { JiraSetupWebview } from '../jira/JiraSetupWebview';
import { JiraSyncService } from '../jira/JiraSyncService';
import { validateWebviewMessage, generateNonce } from '../utils/webviewSecurity';
import { VernoArtifactService } from '../services/artifact/VernoArtifactService';
import { SprintPlannerAgent } from '../agents/BMAD/SprintPlannerAgent';
import { SprintPlan } from '../types/sprint';

/** Allowlist of message types accepted by the SDLC panel. */
const SDLC_ALLOWED_TYPES = [
    'start-debate', 'approve-prd', 'revise-prd', 'push-jira',
    'retry-item', 'complete-flow', 'load-state', 'open-jira-setup',
    'generateSprintPlan'
] as const;

interface SDLCState {
    currentPhase: 'TOPIC_INPUT' | 'DEBATE' | 'PRD_REVIEW' | 'TASK_BREAKDOWN' | 'JIRA_PUSH' | 'COMPLETE';
    topic: string;
    debateMessages: DebateMessage[];
    prdDocument: PRDDocument | null;
    epics: Epic[];
}

export class SDLCWebviewPanel {
    public static currentPanel: SDLCWebviewPanel | undefined;
    public readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly logger: Logger;
    private readonly llmService: LLMService;
    
    private state: SDLCState = {
        currentPhase: 'TOPIC_INPUT',
        topic: '',
        debateMessages: [],
        prdDocument: null,
        epics: []
    };

    private debateOrchestrator: DebateOrchestrator;
    private artifacts: VernoArtifactService | null = null;

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, logger: Logger, llmService: LLMService) {
        this.panel = panel;
        this.context = context;
        this.logger = logger;
        this.llmService = llmService;
        this.debateOrchestrator = new DebateOrchestrator(llmService, logger);

        // Initialize artifact service if workspace is open
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) { this.artifacts = new VernoArtifactService(root); }

        this.panel.onDidDispose(() => this.dispose());
        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (!validateWebviewMessage(message, SDLC_ALLOWED_TYPES)) { return; }
            const msg = message as any; // type validated above
            switch(msg.type) {
                case 'start-debate':
                    this.state.topic = msg.topic;
                    this.setPhase('DEBATE');
                    await this.runDebateFlow();
                    break;
                case 'approve-prd':
                    this.setPhase('TASK_BREAKDOWN');
                    await this.decomposePRD();
                    break;
                case 'revise-prd':
                    this.state.debateMessages = [];
                    this.state.topic = msg.feedback;
                    this.setPhase('DEBATE');
                    await this.runDebateFlow(msg.feedback);
                    break;
                case 'push-jira':
                    this.setPhase('JIRA_PUSH');
                    await this.pushToJira(msg.dryRun);
                    break;
                case 'retry-item':
                    await this.pushToJira(false);
                    break;
                case 'complete-flow':
                    this.setPhase('COMPLETE');
                    if (this.state.prdDocument) {
                        await vscode.commands.executeCommand('verno.startBMADAfterSDLC', this.state.prdDocument);
                    }
                    break;
                case 'load-state':
                    this.loadState();
                    break;
                case 'open-jira-setup':
                    JiraSetupWebview.createOrShow(this.context, this.logger);
                    break;
                case 'generateSprintPlan':
                    await this.generateSprintPlan(msg.capacity);
                    break;
            }
        });
    }

    public static createOrShow(context: vscode.ExtensionContext, logger: Logger, llmService: LLMService, topic?: string) {
        if (SDLCWebviewPanel.currentPanel) {
            SDLCWebviewPanel.currentPanel.panel.reveal();
            if (topic) {
                SDLCWebviewPanel.currentPanel.panel.webview.postMessage({ type: 'init-topic', topic });
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel('sdlcFlow', 'Verno SDLC Orchestrator', vscode.ViewColumn.One, { enableScripts: true });
        SDLCWebviewPanel.currentPanel = new SDLCWebviewPanel(panel, context, logger, llmService);
        SDLCWebviewPanel.currentPanel.panel.webview.html = SDLCWebviewPanel.currentPanel.getHtml();
        
        if (topic) {
            setTimeout(() => {
                SDLCWebviewPanel.currentPanel?.panel.webview.postMessage({ type: 'init-topic', topic });
            }, 500);
        }
    }

    public dispose() {
        SDLCWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
    }

    private setPhase(phase: SDLCState['currentPhase']) {
        this.state.currentPhase = phase;
        this.saveState();
        this.panel.webview.postMessage({ type: 'phase-changed', phase });
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private saveState() {
        if (!this.artifacts) {
            const root = this.getWorkspaceRoot();
            if (root) { this.artifacts = new VernoArtifactService(root); }
        }
        this.artifacts?.writeJSON('sdlc-state.json', this.state);
    }

    private loadState() {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }
        if (!this.artifacts) { this.artifacts = new VernoArtifactService(root); }
        const saved = this.artifacts.readJSON<SDLCState>('sdlc-state.json');
        if (saved) {
            this.state = saved;
            this.panel.webview.postMessage({ type: 'state-loaded', state: this.state });
        }
    }

    private async runDebateFlow(feedback?: string) {
        const topic = feedback ? `Feedback on previous PRD: ${feedback}` : this.state.topic;
        
        const prd = await this.debateOrchestrator.runDebate(topic, (msg) => {
            this.state.debateMessages.push(msg);
            this.saveState();
            this.panel.webview.postMessage({ type: 'debate-message', payload: msg });
        });

        this.state.prdDocument = prd;
        this.setPhase('PRD_REVIEW');
        this.panel.webview.postMessage({ type: 'prd-ready', payload: prd });
    }

    private async decomposePRD() {
        if (!this.state.prdDocument) return;
        
        this.logger.info('Decomposing PRD into Epics and Stories...');
        const prompt = `You are a Technical Agile Coach. Decompose the following PRD into Epics, Stories, and SubTasks.
Crucially, DIVIDE THESE TASKS exclusively among the 7 BMAD Agents: 
['analyst', 'architect', 'ux', 'developer', 'pm', 'qa', 'techwriter'].
Ensure there are specific tasks distributed for everyone (e.g., QA tasks, Docs tasks, Architecture tasks).

PRD:
${JSON.stringify(this.state.prdDocument.sections)}

Respond ONLY with valid JSON matching this structure:
[
  {
    "id": "e1",
    "title": "Epic Title",
    "description": "Epic description",
    "syncStatus": "pending",
    "assignedAgent": "pm",
    "stories": [
      {
        "id": "s1",
        "title": "Story Title",
        "description": "Story description",
        "storyPoints": 3,
        "priority": "High",
        "status": "To Do",
        "syncStatus": "pending",
        "parentEpicId": "e1",
        "assignedAgent": "architect",
        "subtasks": [
          { "id": "st1", "title": "Subtask title", "status": "To Do", "syncStatus": "pending", "parentStoryId": "s1", "assignedAgent": "developer" }
        ]
      }
    ]
  }
]`;

        let result = await this.llmService.generateText(prompt);
        result = result.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            this.state.epics = JSON.parse(result);
            if (!this.artifacts) {
                const root = this.getWorkspaceRoot();
                if (root) { this.artifacts = new VernoArtifactService(root); }
            }
            if (this.artifacts) {
                this.artifacts.write('tasks.md', `<h1>Generated Tasks</h1><pre>${JSON.stringify(this.state.epics, null, 2)}</pre>`);
                this.artifacts.writeJSON('tasks.json', this.state.epics);
            }
            this.saveState();
            this.panel.webview.postMessage({ type: 'tasks-ready', payload: this.state.epics });
            
            const isAuth = await JiraAuthService.getInstance(this.context).isAuthenticated();
            this.panel.webview.postMessage({ type: 'jira-status', isAuth });
        } catch(e: any) {
            this.logger.error('Failed to decompose PRD: ' + e);
            vscode.window.showErrorMessage('Decomposition failed. See logs.');
        }
    }

    private async pushToJira(dryRun: boolean) {
        const auth = JiraAuthService.getInstance(this.context);
        const creds = await auth.getCredentials();
        if (!creds) {
            vscode.window.showErrorMessage('Jira credentials not found.');
            return;
        }

        const root = this.getWorkspaceRoot();
        if (!root) return;
        
        let config: any = {};
        try {
            config = JSON.parse(fs.readFileSync(path.join(root, '.verno', 'jira-config.json'), 'utf-8'));
        } catch(e) {
            vscode.window.showErrorMessage('Jira config missing. Run Jira Setup first.');
            return;
        }

        const syncService = new JiraSyncService(this.logger);
        
        await syncService.syncEpics(
            this.state.epics,
            creds,
            config.projectKey,
            { storyPointsFieldId: config.storyPointsFieldId },
            config.issueTypes,
            (itemId, status) => {
                this.panel.webview.postMessage({ type: 'sync-update', payload: { itemId, syncStatus: status } });
            },
            dryRun
        );

        this.saveState();
    }

    private async generateSprintPlan(capacity: number): Promise<void> {
        if (!this.state.epics || this.state.epics.length === 0) {
            vscode.window.showErrorMessage('No epics available. Complete task breakdown first.');
            return;
        }
        const agent = new SprintPlannerAgent(this.logger);
        const plan: SprintPlan = agent.plan(this.state.epics, capacity);
        this.panel.webview.postMessage({ type: 'sprintPlanReady', payload: plan });
        this.logger.info(`[SDLCWebviewPanel] Sprint plan generated: ${plan.sprints.length} sprints`);
    }

    private getNonce() {
        return generateNonce();
    }

    private getHtml() {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <style>
        body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-foreground); padding: 20px; }
        .section { display: none; margin-bottom: 30px; }
        .active { display: block; }
        .chat-msg { margin: 10px 0; padding: 10px; border-radius: 5px; background: var(--vscode-textBlockQuote-background); }
        .chat-msg b { color: var(--vscode-textLink-foreground); }
        button { padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; margin-right: 10px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        textarea, input { width: 100%; padding: 8px; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); margin-bottom: 15px; }
        .prd-section { margin-bottom: 24px; border-left: 3px solid var(--vscode-panel-border); padding-left: 12px; }
        .prd-section.security-section { border-left-color: #e67e22; }
        .pill { display: inline-block; padding: 2px 6px; font-size: 10px; border-radius: 10px; background: #666; color: #fff; margin-left: 10px; }
        .pill.pending { background: #f39c12; }
        .pill.pushed { background: #2ecc71; }
        .pill.failed { background: #e74c3c; }
        /* Compliance flag badges */
        .compliance-flags { margin-top: 10px; }
        .flag-badge { display: block; margin: 4px 0; padding: 6px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .flag-gdpr { background: rgba(52,152,219,0.15); border-left: 3px solid #3498db; color: #3498db; }
        .flag-hipaa { background: rgba(231,76,60,0.15); border-left: 3px solid #e74c3c; color: #e74c3c; }
        .flag-owasp { background: rgba(230,126,34,0.15); border-left: 3px solid #e67e22; color: #e67e22; }
        /* Security agent highlight in debate log */
        .chat-msg.security-agent { border-left: 3px solid #e74c3c; background: rgba(231,76,60,0.08); }
    </style>
</head>
<body>
    <h1>SDLC Orchestrator</h1>

    <!-- PRE-LOAD Check -->
    <div id="loading" class="section active">Loading state...</div>

    <!-- TOPIC_INPUT -->
    <div id="TOPIC_INPUT" class="section">
        <h3>What are we building today?</h3>
        <textarea id="topicInput" rows="4" placeholder="Describe the feature or application..."></textarea>
        <button id="startDebateBtn">Start PRD Generation (AI Debate)</button>
    </div>

    <!-- DEBATE -->
    <div id="DEBATE" class="section">
        <h3>Agent Debate in Progress...</h3>
        <div id="debateLog"></div>
        <div id="debateSpinner">Generating next response...</div>
    </div>

    <!-- PRD_REVIEW -->
    <div id="PRD_REVIEW" class="section">
        <h3>Review Product Requirements Document</h3>
        <div id="prdContent" style="background:var(--vscode-editor-inactiveSelectionBackground); padding: 15px; border-radius:5px; margin-bottom:15px; height: 300px; overflow-y:auto;"></div>
        <button id="approvePrdBtn">Approve & Generate Tasks</button>
        <textarea id="revisionFeedback" rows="2" placeholder="Feedback for revision..."></textarea>
        <button id="revisePrdBtn">Request Revision</button>
    </div>

    <!-- TASK_BREAKDOWN & JIRA_PUSH -->
    <div id="TASK_BREAKDOWN" class="section">
        <h3>Task Breakdown</h3>
        <div id="epicsList"></div>
        
        <!-- Sprint Planner -->
        <div id="sprintPlannerSection" style="margin-top:20px; border-top:1px solid var(--vscode-panel-border); padding-top:20px; display:none;">
            <h4>⚡ Sprint Planner</h4>
            <label>Team Capacity: <input type="number" id="capacityInput" value="40" min="1" style="width:80px;"> story points per sprint</label>
            <button id="generateSprintBtn" style="margin-left:10px;">Generate Sprint Plan</button>
            <div id="sprintPlanOutput" style="margin-top:15px;"></div>
        </div>

        <div id="jiraControls" style="margin-top:20px; border-top:1px solid var(--vscode-panel-border); padding-top:20px;">
            <div id="setupMsg">You need to connect Jira first. <button id="setupJiraBtn">Setup Jira</button></div>
            <div id="pushActions" style="display:none;">
                <button id="dryRunBtn">Dry Run Sync</button>
                <button id="pushJiraBtn">Push to Jira</button>
            </div>
            <button id="skipJiraBtn">Skip Jira & Continue to Code</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let state = null;
        let isJiraAuth = false;

        vscode.postMessage({ type: 'load-state' });

        window.addEventListener('message', e => {
            const msg = e.data;
            if (msg.type === 'state-loaded') {
                state = msg.state;
                if (state.currentPhase !== 'TOPIC_INPUT') {
                    showSection(state.currentPhase);
                    if (state.debateMessages) state.debateMessages.forEach(appendDebateMsg);
                    if (state.prdDocument) renderPRD(state.prdDocument);
                    if (state.epics && state.epics.length>0) renderEpics(state.epics);
                } else {
                    showSection('TOPIC_INPUT');
                }
            } else if (msg.type === 'init-topic') {
                document.getElementById('topicInput').value = msg.topic;
                showSection('TOPIC_INPUT');
            } else if (msg.type === 'phase-changed') {
                showSection(msg.phase);
            } else if (msg.type === 'debate-message') {
                document.getElementById('debateSpinner').style.display = msg.payload.type === 'consensus' ? 'none' : 'block';
                appendDebateMsg(msg.payload);
            } else if (msg.type === 'prd-ready') {
                renderPRD(msg.payload);
            } else if (msg.type === 'tasks-ready') {
                renderEpics(msg.payload);
                document.getElementById('sprintPlannerSection').style.display = 'block';
            } else if (msg.type === 'jira-status') {
                isJiraAuth = msg.isAuth;
                if(isJiraAuth) {
                    document.getElementById('setupMsg').style.display = 'none';
                    document.getElementById('pushActions').style.display = 'block';
                }
            } else if (msg.type === 'sync-update') {
                const p = document.getElementById('status-'+msg.payload.itemId);
                if(p) {
                    p.className = 'pill ' + msg.payload.syncStatus;
                    p.innerText = msg.payload.syncStatus.toUpperCase();
                }
            } else if (msg.type === 'sprintPlanReady') {
                renderSprintPlan(msg.payload);
            }
        });

        function showSection(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            if(id==='JIRA_PUSH') id = 'TASK_BREAKDOWN';
            if(id==='COMPLETE') return;
            const el = document.getElementById(id);
            if(el) el.classList.add('active');
        }

        function appendDebateMsg(m) {
            const d = document.createElement('div');
            const isSecurityAgent = m.agentId === 'security';
            d.className = 'chat-msg' + (isSecurityAgent ? ' security-agent' : '');
            const agentLabel = isSecurityAgent
                ? '<b style="color:#e74c3c">🔐 SECURITY (Round ' + m.round + '):</b>'
                : '<b>' + m.agentId.toUpperCase() + ' (Round ' + m.round + '):</b>';
            d.innerHTML = agentLabel + ' <br/> ' + m.content;
            document.getElementById('debateLog').appendChild(d);
        }

        function renderPRD(prd) {
            let html = '<h2>' + prd.title + '</h2>';
            prd.sections.forEach(s => {
                const isSecSection = s.title.toLowerCase().includes('security');
                const cssClass = 'prd-section' + (isSecSection ? ' security-section' : '');
                // Content: replace literal \\n and newlines with <br/>
                const contentHtml = s.content
                    .replace(/\\n/g, '<br/>')
                    .replace(/\n/g, '<br/>');
                let flagsHtml = '';
                if (s.complianceFlags && s.complianceFlags.length > 0) {
                    flagsHtml = '<div class="compliance-flags">';
                    s.complianceFlags.forEach(flag => {
                        let cls = 'flag-badge ';
                        if (flag.includes('GDPR')) cls += 'flag-gdpr';
                        else if (flag.includes('HIPAA')) cls += 'flag-hipaa';
                        else cls += 'flag-owasp';
                        flagsHtml += '<span class="' + cls + '">' + flag + '</span>';
                    });
                    flagsHtml += '</div>';
                }
                html += '<div class="' + cssClass + '"><h4>' + s.title + '</h4><div>' + contentHtml + '</div>' + flagsHtml + '</div>';
            });
            document.getElementById('prdContent').innerHTML = html;
        }

        function renderEpics(epics) {
            let html = '';
            epics.forEach(e => {
                let ag = e.assignedAgent ? ' <span style="color:#a855f7;font-size:10px;">[' + e.assignedAgent.toUpperCase() + ']</span>' : '';
                html += '<div><b>Epic:</b> ' + e.title + ag + ' <span class="pill ' + e.syncStatus + '" id="status-' + e.id + '">' + e.syncStatus.toUpperCase() + '</span></div>';
                e.stories.forEach(s => {
                    let sag = s.assignedAgent ? ' <span style="color:#a855f7;font-size:10px;">[' + s.assignedAgent.toUpperCase() + ']</span>' : '';
                    html += '<div style="margin-left:20px;"><b>Story:</b> ' + s.title + sag + '  <span class="pill ' + s.syncStatus + '" id="status-' + s.id + '">' + s.syncStatus.toUpperCase() + '</span></div>';
                    s.subtasks.forEach(st => {
                        let stag = st.assignedAgent ? ' <span style="color:#a855f7;font-size:10px;">[' + st.assignedAgent.toUpperCase() + ']</span>' : '';
                        html += '<div style="margin-left:40px;"><b>Subtask:</b> ' + st.title + stag + '  <span class="pill ' + st.syncStatus + '" id="status-' + st.id + '">' + st.syncStatus.toUpperCase() + '</span></div>';
                    });
                });
            });
            document.getElementById('epicsList').innerHTML = html;
        }

        function renderSprintPlan(plan) {
            let html = '<h4>Sprint Plan — ' + plan.sprints.length + ' sprints (' + plan.totalStoryPoints + ' SP total)</h4>';
            plan.sprints.forEach(sprint => {
                const pct = plan.capacityPerSprint > 0 ? Math.round((sprint.totalPoints / plan.capacityPerSprint) * 100) : 0;
                html += '<details style="margin-bottom:10px; border:1px solid var(--vscode-panel-border); border-radius:4px; padding:8px;">';
                html += '<summary style="cursor:pointer; font-weight:600;">' + sprint.name + ' — ' + sprint.totalPoints + '/' + plan.capacityPerSprint + ' SP';
                html += ' <span style="font-size:11px; opacity:0.7;">(' + pct + '%)</span></summary>';
                html += '<div style="margin-top:8px;">';
                sprint.stories.forEach(s => {
                    const isCritical = plan.criticalPath.includes(s.id);
                    const icon = isCritical ? '⚡ ' : '';
                    const pts = s.storyPoints !== undefined ? ' [' + s.storyPoints + ' SP]' : '';
                    html += '<div style="padding:4px 0; font-size:12px;">' + icon + s.title + '<span style="opacity:0.6;">' + pts + '</span></div>';
                });
                html += '</div></details>';
            });
            document.getElementById('sprintPlanOutput').innerHTML = html;
        }

        document.getElementById('generateSprintBtn').addEventListener('click', () => {
            const cap = parseInt(document.getElementById('capacityInput').value, 10) || 40;
            vscode.postMessage({ type: 'generateSprintPlan', capacity: cap });
        });
        document.getElementById('startDebateBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'start-debate', topic: document.getElementById('topicInput').value });
        });
        document.getElementById('approvePrdBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'approve-prd' });
        });
        document.getElementById('revisePrdBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'revise-prd', feedback: document.getElementById('revisionFeedback').value });
        });
        document.getElementById('setupJiraBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'open-jira-setup' });
        });
        document.getElementById('dryRunBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'push-jira', dryRun: true });
        });
        document.getElementById('pushJiraBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'push-jira', dryRun: false });
        });
        document.getElementById('skipJiraBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'complete-flow' });
        });
    </script>
</body>
</html>`;
    }
}
