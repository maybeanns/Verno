import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { TodoService } from '../../services/todo';
import { FeedbackService } from '../../services/feedback';
import { ConversationService } from '../../services/conversation';
import * as path from 'path';
import { validateWebviewMessage, generateNonce } from '../../utils/webviewSecurity';
import { VernoArtifactService } from '../../services/artifact/VernoArtifactService';
import { SprintPlan } from '../../types/sprint';

/** Allowlist of message types accepted by the Enhanced Sidebar. */
const ENHANCED_ALLOWED_TYPES = [
    'getTodos', 'getFeedback', 'getConversations',
    'loadConversation', 'deleteConversation', 'updateTodoStatus',
    'getSprintPlan'
] as const;

export class EnhancedSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'verno-enhanced-sidebar';
    private _view?: vscode.WebviewView;
    private logger: Logger;
    private todoService?: TodoService;
    private feedbackService?: FeedbackService;
    private conversationService?: ConversationService;

    constructor(
        private readonly workspaceRoot: string
    ) {
        this.logger = new Logger('EnhancedSidebar');
        this.initializeServices();
    }

    private initializeServices(): void {
        this.todoService = new TodoService(this.workspaceRoot);
        this.feedbackService = new FeedbackService(this.workspaceRoot);
        this.conversationService = new ConversationService(this.workspaceRoot);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview — allowlist validated
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (!validateWebviewMessage(message, ENHANCED_ALLOWED_TYPES, this.logger)) { return; }
            const data = message as any; // type validated above
            try {
                switch (data.type) {
                    case 'getTodos':
                        this.sendTodosToWebview();
                        break;
                    case 'getFeedback':
                        this.sendFeedbackToWebview();
                        break;
                    case 'getConversations':
                        this.sendConversationsToWebview();
                        break;
                    case 'loadConversation':
                        await vscode.commands.executeCommand('verno.loadConversation', data.conversationId);
                        break;
                    case 'deleteConversation':
                        if (this.conversationService) {
                            this.conversationService.deleteConversation(data.conversationId);
                            this.sendConversationsToWebview();
                        }
                        break;
                    case 'updateTodoStatus':
                        if (this.todoService) {
                            this.todoService.updateTaskStatus(data.agent, data.taskId, data.status);
                            this.sendTodosToWebview();
                        }
                        break;
                    case 'getSprintPlan':
                        this.sendSprintPlanToWebview();
                        break;
                }
            } catch (error) {
                this.logger.error('Error handling message', error as Error);
            }
        });

        // Initial data load
        setTimeout(() => {
            this.sendTodosToWebview();
            this.sendConversationsToWebview();
            this.sendFeedbackToWebview();
            this.sendSprintPlanToWebview();
        }, 500);
    }

    private sendTodosToWebview(): void {
        if (!this._view || !this.todoService) return;
        try {
            const summary = this.todoService.getTodoList('Orchestrator'); // Get raw list if possible, or summary
            // For now, let's keep using the summary method but ideally we'd send structured data
            // The previous implementation sent text. Let's send the raw object if we can, 
            // but TodoService.getTodoSummary returns string. 
            // let's stick to text for todos for now as the user asked specifically about history and feedback cleaning.
            const content = this.todoService.getTodoSummary();
            this._view.webview.postMessage({ type: 'todosUpdate', content });
        } catch (error) {
            this.logger.error('Error sending TODOs', error as Error);
        }
    }

    private sendFeedbackToWebview(): void {
        if (!this._view || !this.feedbackService) return;
        // Send STRUCTURED data
        const feedbackMap = this.feedbackService.getAllAgentsFeedback();
        // Convert Map to array for JSON serialization
        const feedbackArray = Array.from(feedbackMap.entries()).map(([agent, list]) => ({
            agent,
            latest: list[0]
        }));

        this._view.webview.postMessage({
            type: 'feedbackUpdate',
            data: feedbackArray
        });
    }

    private sendConversationsToWebview(): void {
        if (!this._view || !this.conversationService) return;
        const conversations = this.conversationService.getAllConversations();
        this._view.webview.postMessage({
            type: 'conversationsUpdate',
            conversations
        });
    }

    private sendSprintPlanToWebview(): void {
        if (!this._view) { return; }
        const artifacts = new VernoArtifactService(this.workspaceRoot);
        const plan = artifacts.readJSON<SprintPlan>('sprint-plan.json');
        this._view.webview.postMessage({ type: 'sprintPlanUpdate', plan });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
             <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <style>
                :root {
                    --container-paddding: 20px;
                    --input-padding-vertical: 6px;
                    --input-padding-horizontal: 4px;
                    --input-margin-vertical: 4px;
                    --input-margin-horizontal: 0;
                }
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-sideBar-background);
                }
                .tabs {
                    display: flex;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-sideBar-background);
                }
                .tab {
                    padding: 10px 15px;
                    cursor: pointer;
                    opacity: 0.7;
                    border-bottom: 2px solid transparent;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
                .tab.active {
                    opacity: 1;
                    border-bottom-color: var(--vscode-panelTitle-activeBorder);
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .content { padding: 15px; display: none; height: calc(100vh - 45px); overflow-y: auto; }
                .content.active { display: block; }
                
                /* Cards */
                .card {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                    color: var(--vscode-descriptionForeground);
                }
                .card-title {
                    font-size: 14px;
                    font-weight: bold;
                    color: var(--vscode-foreground);
                    margin-bottom: 4px;
                    text-transform: none;
                }
                
                /* Conversation Specific */
                .conv-card {
                    cursor: pointer;
                    transition: transform 0.1s;
                    position: relative;
                }
                .conv-card:hover { border-color: var(--vscode-focusBorder); }
                .conv-meta {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    display: flex;
                    gap: 10px;
                }
                .mode-tag {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                }
                .delete-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: transparent;
                    border: none;
                    color: var(--vscode-errorForeground);
                    cursor: pointer;
                    opacity: 0;
                    font-weight: bold;
                }
                .conv-card:hover .delete-btn { opacity: 1; }

                /* Feedback Specific */
                .feedback-section h4 {
                    margin: 8px 0 4px 0;
                    font-size: 12px;
                    color: var(--vscode-textLink-foreground);
                }
                .feedback-list { margin: 0; padding-left: 16px; font-size: 12px; }
                .feedback-list li { margin-bottom: 4px; }
                .issue-high { color: var(--vscode-errorForeground); }
                .issue-medium { color: var(--vscode-charts-yellow); }
                
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="tabs">
                <div class="tab active" data-target="conversations">Conversations</div>
                <div class="tab" data-target="feedback">Feedback</div>
                <div class="tab" data-target="todos">Tasks</div>
                <div class="tab" data-target="sprints">Sprints</div>
            </div>

            <!-- Conversations Panel -->
            <div id="conversations" class="content active">
                <div id="conv-list">Loading...</div>
            </div>

            <!-- Feedback Panel -->
            <div id="feedback" class="content">
                <div id="feedback-list">Loading...</div>
            </div>

            <!-- Todos Panel -->
            <div id="todos" class="content">
                <pre id="todo-content" style="font-family: var(--vscode-editor-font-family); font-size: 12px;">Loading...</pre>
            </div>

            <!-- Sprints Panel -->
            <div id="sprints" class="content">
                <div id="sprint-list">Loading...</div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                // Tab Switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
                        
                        tab.classList.add('active');
                        document.getElementById(tab.dataset.target).classList.add('active');
                    });
                });

                // Renderers
                function renderSprintPlan(plan) {
                    const container = document.getElementById('sprint-list');
                    if (!plan || !plan.sprints || plan.sprints.length === 0) {
                        container.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.6">No sprint plan yet. Generate one from the SDLC panel.</div>';
                        return;
                    }
                    let html = '<div style="padding:8px 0; font-size:12px; opacity:0.7;">' + plan.sprints.length + ' sprints · ' + plan.totalStoryPoints + ' SP total · ' + plan.capacityPerSprint + ' SP/sprint</div>';
                    plan.sprints.forEach(sprint => {
                        const pct = plan.capacityPerSprint > 0 ? Math.round((sprint.totalPoints / plan.capacityPerSprint) * 100) : 0;
                        html += '<div class="card">';
                        html += '<div class="card-header">' + sprint.name + '<span style="font-weight:normal;">' + sprint.totalPoints + '/' + plan.capacityPerSprint + ' SP</span></div>';
                        html += '<div style="background:var(--vscode-progressBar-background,#0e70c0);height:4px;width:' + Math.min(pct,100) + '%;border-radius:2px;margin-bottom:8px;"></div>';
                        sprint.stories.forEach(s => {
                            const isCritical = plan.criticalPath.includes(s.id);
                            const pts = s.storyPoints !== undefined ? s.storyPoints : '?';
                            html += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;">';
                            html += '<span>' + (isCritical ? '⚡ ' : '') + s.title + '</span>';
                            html += '<span style="opacity:0.6;white-space:nowrap;margin-left:8px;">' + pts + ' SP</span>';
                            html += '</div>';
                        });
                        html += '</div>';
                    });
                    container.innerHTML = html;
                }

                function renderConversations(list) {
                    const container = document.getElementById('conv-list');
                    if (!list || list.length === 0) {
                        container.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.6">No conversations found</div>';
                        return;
                    }
                    
                    container.innerHTML = list.map(c => \`
                        <div class="card conv-card" onclick="loadConv('\${c.id}')">
                            <button class="delete-btn" onclick="deleteConv(event, '\${c.id}')">×</button>
                            <div class="card-title">\${c.title || 'Untitled Session'}</div>
                            <div class="conv-meta">
                                <span class="mode-tag">\${c.mode || 'chat'}</span>
                                <span>\${new Date(c.updatedAt).toLocaleDateString()}</span>
                                <span>\${c.messages.length} msgs</span>
                            </div>
                        </div>
                    \`).join('');
                }

                function renderFeedback(data) {
                    const container = document.getElementById('feedback-list');
                    if (!data || data.length === 0) {
                        container.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.6">No feedback available yet</div>';
                        return;
                    }

                    container.innerHTML = data.map(item => {
                        const fb = item.latest;
                        if (!fb) return '';
                        
                        return \`
                        <div class="card">
                            <div class="card-header">\${item.agent}</div>
                            
                            <div class="feedback-section">
                                <h4>✅ Completed</h4>
                                <ul class="feedback-list">
                                    \${fb.completedTasks.map(t => \`<li>\${t}</li>\`).join('')}
                                </ul>
                            </div>

                            \${fb.issuesEncountered.length > 0 ? \`
                            <div class="feedback-section">
                                <h4>⚠️ Issues</h4>
                                <ul class="feedback-list">
                                    \${fb.issuesEncountered.map(i => \`<li class="issue-\${i.severity}">\${i.severity.toUpperCase()}: \${i.description}</li>\`).join('')}
                                </ul>
                            </div>
                            \` : ''}

                            \${fb.nextSteps.length > 0 ? \`
                            <div class="feedback-section">
                                <h4>➡️ Next Steps</h4>
                                <ul class="feedback-list">
                                    \${fb.nextSteps.map(s => \`<li>\${s}</li>\`).join('')}
                                </ul>
                            </div>
                            \` : ''}
                        </div>
                        \`;
                    }).join('');
                }

                // Actions
                window.loadConv = (id) => {
                    vscode.postMessage({ type: 'loadConversation', conversationId: id });
                };

                window.deleteConv = (e, id) => {
                    e.stopPropagation();
                    if(confirm('Delete this conversation?')) {
                        vscode.postMessage({ type: 'deleteConversation', conversationId: id });
                    }
                };

                // Message Handler
                window.addEventListener('message', event => {
                    const msg = event.data;
                    switch(msg.type) {
                        case 'sprintPlanUpdate':
                            renderSprintPlan(msg.plan);
                            break;
                        case 'conversationsUpdate':
                            renderConversations(msg.conversations);
                            break;
                        case 'feedbackUpdate':
                            renderFeedback(msg.data);
                            break;
                        case 'todosUpdate':
                            document.getElementById('todo-content').textContent = msg.content;
                            break;
                    }
                });

                // Initial request
                vscode.postMessage({ type: 'getConversations' });
                vscode.postMessage({ type: 'getFeedback' });
                vscode.postMessage({ type: 'getTodos' });
                vscode.postMessage({ type: 'getSprintPlan' });

            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    return generateNonce();
}
