import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { generateNonce } from '../../utils/webviewSecurity';

export class CoverageSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'verno-coverage-sidebar';
    private _view?: vscode.WebviewView;
    private logger: Logger;

    constructor(private readonly workspaceRoot: string) {
        this.logger = new Logger('CoverageSidebar');
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

        // Initial update
        this.updateCoverage();

        // Watch for changes in coverage file
        const coverageFile = path.join(this.workspaceRoot, '.verno', 'coverage', 'coverage-summary.json');
        if (fs.existsSync(path.dirname(coverageFile))) {
            fs.watch(path.dirname(coverageFile), (event, filename) => {
                if (filename === 'coverage-summary.json') {
                    this.updateCoverage();
                }
            });
        }
    }

    private updateCoverage() {
        if (!this._view) return;

        const coverageFile = path.join(this.workspaceRoot, '.verno', 'coverage', 'coverage-summary.json');
        let data = null;

        if (fs.existsSync(coverageFile)) {
            try {
                data = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
            } catch (err) {
                this.logger.error('Failed to parse coverage summary', err as Error);
            }
        }

        this._view.webview.postMessage({ type: 'updateCoverage', data });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = generateNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <style>
                body {
                    padding: 15px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-sideBar-background);
                }
                .header {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .coverage-card {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 12px;
                }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 13px;
                }
                .bar-container {
                    background: var(--vscode-widget-border);
                    height: 6px;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 4px;
                }
                .bar {
                    height: 100%;
                    transition: width 0.3s ease;
                }
                .high { background-color: var(--vscode-testing-iconPassed); }
                .medium { background-color: var(--vscode-charts-yellow); }
                .low { background-color: var(--vscode-testing-iconFailed); }
                
                .empty-state {
                    text-align: center;
                    opacity: 0.6;
                    margin-top: 50px;
                }
                .refresh-btn {
                    cursor: pointer;
                    color: var(--vscode-textLink-foreground);
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <span>Test Coverage</span>
                <span class="refresh-btn" id="refresh-btn">Refresh</span>
            </div>
            <div id="coverage-container">
                <div class="empty-state">No coverage data found. Run tests to generate results.</div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                function getColorClass(pct) {
                    if (pct >= 80) return 'high';
                    if (pct >= 50) return 'medium';
                    return 'low';
                }

                function renderCoverage(data) {
                    const container = document.getElementById('coverage-container');
                    if (!data) {
                        container.innerHTML = '<div class="empty-state">No coverage data found. Ensure .verno/coverage/coverage-summary.json exists.</div>';
                        return;
                    }

                    let html = '';
                    for (const [file, stats] of Object.entries(data)) {
                        const pct = stats.pct || 0;
                        html += \`
                        <div class="coverage-card">
                            <div class="stat-row">
                                <span style="font-weight:600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;" title="\${file}">\${file}</span>
                                <span class="\${getColorClass(pct)}">\${pct}%</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar \${getColorClass(pct)}" style="width: \${pct}%"></div>
                            </div>
                            <div style="font-size: 11px; margin-top: 8px; opacity: 0.7;">
                                \${stats.covered}/\${stats.total} lines covered
                            </div>
                        </div>
                        \`;
                    }
                    container.innerHTML = html;
                }

                window.addEventListener('message', event => {
                    const msg = event.data;
                    if (msg.type === 'updateCoverage') {
                        renderCoverage(msg.data);
                    }
                });

                document.getElementById('refresh-btn').addEventListener('click', () => {
                   // In a real impl, we'd trigger VS Code to re-read
                });
            </script>
        </body>
        </html>`;
    }
}
