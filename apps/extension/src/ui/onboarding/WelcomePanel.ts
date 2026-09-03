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
      --background: oklch(0.2046 0 0);
      --foreground: oklch(0.9219 0 0);
      --card: oklch(0.2686 0 0);
      --card-foreground: oklch(0.9219 0 0);
      --primary: oklch(0.7686 0.1647 70.0804);
      --primary-foreground: oklch(0 0 0);
      --secondary: oklch(0.2686 0 0);
      --secondary-foreground: oklch(0.9219 0 0);
      --muted: oklch(0.2393 0 0);
      --muted-foreground: oklch(0.7155 0 0);
      --accent: oklch(0.4732 0.1247 46.2007);
      --accent-foreground: oklch(0.9243 0.1151 95.7459);
      --border: oklch(0.3715 0 0);
      --glass: rgba(255, 255, 255, 0.03);
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--background);
      color: var(--foreground);
      padding: 60px 40px;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .hero {
      text-align: center;
      margin-bottom: 64px;
      animation: spatialFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes spatialFadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .hero h1 {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-bottom: 16px;
      color: var(--foreground);
      background: linear-gradient(to bottom, var(--foreground), var(--muted-foreground));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .hero p {
      color: var(--muted-foreground);
      font-size: 1.2rem;
      max-width: 600px;
      margin: 0 auto;
      font-weight: 500;
    }

    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 48px;
      max-width: 800px;
      width: 100%;
    }
    
    .mode-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05);
      backdrop-filter: blur(12px);
    }
    
    .mode-card:hover {
      transform: translateY(-8px) scale(1.02);
      border-color: var(--primary);
      box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .mode-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at top left, hsla(var(--primary), 0.1), transparent 70%);
      opacity: 0;
      transition: opacity 0.4s;
    }
    
    .mode-card:hover::before { opacity: 1; }

    .mode-card .icon { 
      font-size: 2.5rem; 
      margin-bottom: 20px; 
      display: inline-block;
      filter: drop-shadow(0 0 10px var(--primary));
    }
    
    .mode-card h3 { 
      color: var(--primary); 
      margin-bottom: 12px; 
      font-size: 1.4rem; 
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    
    .mode-card p { 
      color: var(--muted-foreground); 
      font-size: 1rem; 
      line-height: 1.5;
    }

    .shortcuts {
      max-width: 800px;
      width: 100%;
      margin-bottom: 56px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    
    .shortcuts h3 { 
      color: var(--primary); 
      margin-bottom: 24px; 
      font-size: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 800;
    }
    
    .shortcut-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--border);
    }
    
    .shortcut-row:last-child { border-bottom: none; }
    
    .shortcut-row span { 
      color: var(--foreground); 
      font-size: 1rem; 
      font-weight: 600;
    }
    
    kbd {
      background: var(--muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 10px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9rem;
      color: var(--foreground);
      box-shadow: 0 2px 0 var(--background);
      margin: 0 2px;
    }

    .actions {
      text-align: center;
      display: flex;
      gap: 24px;
      justify-content: center;
      width: 100%;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 16px 40px;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      letter-spacing: -0.01em;
    }
    
    .btn-primary {
      background: var(--primary);
      color: var(--primary-foreground);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2);
    }
    
    .btn-primary:hover {
      transform: translateY(-4px);
      filter: brightness(1.1);
      box-shadow: 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    }
    
    .btn-secondary {
      background: var(--secondary);
      border: 1px solid var(--border);
      color: var(--foreground);
    }
    
    .btn-secondary:hover {
      background: var(--muted);
      border-color: var(--primary);
      transform: translateY(-4px);
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🚀 Welcome to Verno</h1>
    <p>The high-performance SDLC automation engine. Multi-agent debate, spatial design, and zero-to-deployed velocity.</p>
  </div>

  <div class="modes">
    <div class="mode-card">
      <div class="icon">💬</div>
      <h3>Conversational</h3>
      <p>Instant precision with workspace-aware intelligence. Real-time reviews, context-deep debugging, and seamless iteration.</p>
    </div>
    <div class="mode-card">
      <div class="icon">🏗️</div>
      <h3>SDLC Pipeline</h3>
      <p>Automated architectural rigor. From requirements to deployment with an 8-agent swarm and security-first auditing.</p>
    </div>
  </div>

  <div class="shortcuts">
    <h3>⌨️ COMMAND TERMINALS</h3>
    <div class="shortcut-row">
      <span>Open Verno Input</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>;</kbd></div>
    </div>
    <div class="shortcut-row">
      <span>Start Voice Studio</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd></div>
    </div>
    <div class="shortcut-row">
      <span>Launch Pipeline</span>
      <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd></div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-secondary" onclick="postMsg('setApiKey')">🔑 CONFIGURE API</button>
    <button class="btn btn-primary" onclick="postMsg('dismiss')">✨ INITIALIZE V1.0</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function postMsg(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }
}
