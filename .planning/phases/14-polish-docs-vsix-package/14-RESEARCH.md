# Phase 14: Polish, Documentation & VSIX Package — Research

## Goal
Final milestone: onboarding wizard, comprehensive README rewrite with architecture diagram, EXT-01/02/03 cleanup, version bump to 1.0.0, and a `vsce package` producing a valid VSIX for FYP evaluation.

## 1. UX Polish & Onboarding (14-01)

### 1a. Welcome/Onboarding Page
VS Code supports a one-time `WebviewPanel` that shows on first install. We detect first-run via `globalState.get('verno.onboarded')`. The panel should:
- Explain the two modes (Conversational + Development/SDLC)
- Guide the user to set their API key
- Link to keyboard shortcuts

### 1b. Keyboard Shortcuts
`package.json` `keybindings` contribution point:
- `Ctrl+Shift+V` → `verno.processInput` (text input)
- `Ctrl+Shift+R` → `verno.startRecording` (voice)
- `Ctrl+Shift+S` → `verno.startSDLC` (SDLC pipeline)

### 1c. EXT-02 — `logger.show()` removal from activation
Currently `logger.show()` exists only inside the `verno.showOutput` command handler (line 202 of extension.ts). This is already opt-in — the requirement is satisfied. Verify no auto-show calls exist elsewhere.

### 1d. EXT-03 — Redirect IMPLEMENTATION.md
`DeveloperAgent.ts` line 215 writes `${context.workspaceRoot}/IMPLEMENTATION.md`. Change to `${context.workspaceRoot}/.verno/IMPLEMENTATION.md`.

### 1e. Mode Toggle
A status bar button that toggles between "💬 Chat" and "🏗️ SDLC" mode, toggling `verno.mode` context variable. The sidebar can read this to show different UIs.

## 2. Final Docs & VSIX Package (14-02)

### 2a. README Rewrite
The current README is functional but stale — it doesn't mention:
- 9-phase SDLC pipeline
- Security persona in debates
- Self-healing code generation
- Streaming markdown
- OWASP/GDPR compliance
- Pre-commit secret scanner
- OpenTelemetry / Grafana generation
- CI/CD scaffold
- README auto-sync / changelog generation
- Mock testing infrastructure

Need a complete rewrite with:
- Architecture diagram (Mermaid in README)
- Feature table covering all 14 phases
- Installation section
- Configuration section (all settings)
- Command reference (all 16+ commands)

### 2b. CONTRIBUTING.md
Standard template: fork → branch → PR. Test instructions: `npm ci && npm run compile && npm test`.

### 2c. Version Bump to 1.0.0
- `package.json` version → `1.0.0`
- Release notes block for 1.0.0

### 2d. VSIX Package Build
- `npm install -g @vscode/vsce`
- `vsce package` → produces `verno-1.0.0.vsix`
- Validate: `code --install-extension verno-1.0.0.vsix`

### 2e. Smoke Test Checklist
Manual verification:
1. Extension activates without error
2. Sidebar renders correctly
3. API key entry works
4. Voice recording starts/stops
5. Chat mode responds
6. SDLC pipeline triggers debate
7. PRD generated
8. Code generation with quality checks
9. CI scaffold generation
10. Secret scanning works

## Decision Log
| Decision | Rationale |
|----------|-----------|
| Mermaid diagram in README (not image) | Renders natively on GitHub, easy to maintain |
| 1.0.0 version for VSIX | FYP evaluation requires a "release" artifact |
| Onboarding as WebviewPanel, not walkthrough | More control over design, branded experience |
| IMPLEMENTATION.md → .verno/ | EXT-03 compliance, keeps workspace clean |
