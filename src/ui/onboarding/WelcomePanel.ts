import * as vscode from 'vscode';

/**
 * WelcomePanel — Shown on first activation to onboard the user.
 * Explains Verno's two modes (Conversational + SDLC), guides API key setup,
 * and links to keyboard shortcuts.
 */
export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposed = false;

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._context = context;

    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'setApiKey':
          await vscode.commands.executeCommand('verno.clearApiKeys');
          break;
        case 'dismiss':
          await context.globalState.update('verno.onboarded', true);
          this._panel.dispose();
          break;
      }
    });

    this._panel.onDidDispose(() => {
      this._disposed = true;
      WelcomePanel.currentPanel = undefined;
    });
  }

  /**
   * Show the Welcome panel (only once per install).
   */
  public static show(context: vscode.ExtensionContext): void {
    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'verno.welcome',
      'Welcome to Verno',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, context);
  }

  private _getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Verno</title>
  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --accent: #58a6ff;
      --accent-glow: rgba(88, 166, 255, 0.15);
      --green: #3fb950;
      --purple: #bc8cff;
      --text: #c9d1d9;
      --muted: #8b949e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px 32px;
      line-height: 1.6;
    }

    .hero {
      text-align: center;
      margin-bottom: 48px;
    }
    .hero h1 {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .hero p {
      color: var(--muted);
      font-size: 1.05rem;
      max-width: 540px;
      margin: 0 auto;
    }

    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 40px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }
    .mode-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .mode-card:hover {
      border-color: var(--accent);
      box-shadow: 0 0 20px var(--accent-glow);
    }
    .mode-card .icon { font-size: 2rem; margin-bottom: 12px; }
    .mode-card h3 { color: var(--accent); margin-bottom: 8px; font-size: 1.1rem; }
    .mode-card p { color: var(--muted); font-size: 0.9rem; }

    .shortcuts {
      max-width: 700px;
      margin: 0 auto 40px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    .shortcuts h3 { color: var(--accent); margin-bottom: 16px; }
    .shortcut-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .shortcut-row:last-child { border-bottom: none; }
    .shortcut-row span { color: var(--muted); font-size: 0.9rem; }
    kbd {
      background: #21262d;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 2px 8px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.85rem;
      color: var(--text);
    }

    .actions {
      text-align: center;
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--purple));
      color: #fff;
    }
    .btn-primary:hover { box-shadow: 0 4px 20px var(--accent-glow); }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }
    .btn-secondary:hover { border-color: var(--accent); }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🚀 Welcome to Verno</h1>
    <p>Your AI-powered SDLC automation engine. Voice-first, multi-agent, and ready to build software with you.</p>
  </div>

  <div class="modes">
    <div class="mode-card">
      <div class="icon">💬</div>
      <h3>Conversational Mode</h3>
      <p>Always-on AI pair programmer. Ask questions, get code reviews, debug issues — aware of your workspace context and open files.</p>
    </div>
    <div class="mode-card">
      <div class="icon">🏗️</div>
      <h3>SDLC Pipeline Mode</h3>
      <p>Full 9-phase development lifecycle. AI personas debate your idea, generate PRDs, architecture, code, tests, CI/CD, and docs.</p>
    </div>
  </div>

  <div class="shortcuts">
    <h3>⌨️ Keyboard Shortcuts</h3>
    <div class="shortcut-row">
      <span>Open Verno Input</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>;</kbd></div>
    </div>
    <div class="shortcut-row">
      <span>Start Voice Recording</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd></div>
    </div>
    <div class="shortcut-row">
      <span>Launch SDLC Pipeline</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd></div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-secondary" onclick="postMsg('setApiKey')">🔑 Set API Key</button>
    <button class="btn btn-primary" onclick="postMsg('dismiss')">✨ Get Started</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function postMsg(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }
}
