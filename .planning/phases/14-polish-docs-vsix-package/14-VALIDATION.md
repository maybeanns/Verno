---
phase: 14
slug: polish-docs-vsix-package
date: 2026-04-15
---

# Phase 14: Nyquist Validation Strategy

## Dimensions of Verification

### 1. Happy Path
- `vsce package` produces `verno-1.0.0.vsix` with zero warnings.
- Fresh install via `code --install-extension verno-1.0.0.vsix` activates cleanly.
- Sidebar renders, API key prompt appears on first interaction.

### 2. Edge Cases
- Onboarding only shows once (globalState guard).
- README Mermaid diagram renders on GitHub.
- Keyboard shortcuts don't conflict with common VS Code bindings.

### 3. Error Handling
- Missing API key shows a helpful message, not a stack trace.
- Onboarding gracefully degrades if webview creation fails.

### 4. Integration
- All 16+ commands registered and functional.
- Mode toggle correctly switches sidebar context.
- IMPLEMENTATION.md now writes to `.verno/` subdirectory.

### 5. Performance
- Extension activation time remains under 500ms.
- No eager logger.show() calls that steal focus.

### 6. Security/Compliance
- No API keys appear in README or CONTRIBUTING.
- CSP headers maintained in all webview panels.
- Secret scanner hook documented in README.

### 7. Data State
- `globalState.verno.onboarded` persists across restarts.
- Keyboard shortcut preferences don't override user-set bindings.

### 8. Architectural Integrity
- README accurately describes the implemented architecture.
- Every feature mentioned in README has corresponding working code.
- CONTRIBUTING.md build instructions produce a passing build.
