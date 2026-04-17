---
phase: 13
slug: agent-test-coverage-ci-for-verno
date: 2026-04-14
---

# Phase 13: Nyquist Validation Strategy

## Dimensions of Verification

### 1. Happy Path
- `npm run test` executes successfully and reports X passing tests.
- CI triggers on push and pull_request correctly.

### 2. Edge Cases
- Test coverage tests invalid or unparseable JSON from MockLLMService.
- CI pipeline fails if linting fails.

### 3. Error Handling
- Agents bubble up errors gracefully if MockLLMService fails to return tokens.

### 4. Integration
- The `.github/workflows/ci.yml` properly initializes `npm ci` and the xvfb display for vscode extension test runner (`@vscode/test-electron`).

### 5. Performance
- MockLLMService generates tokens synthetically matching the speed of API responses (or instantly to speed up tests).

### 6. Security/Compliance
- `ci.yml` does not expose sensitive tokens inside the github action runner logs.

### 7. Data State
- Clean VSCode workspace environment provided to the test host without bleeding state.

### 8. Architectural Integrity (The Nyquist Threshold)
- Every required agent (Developer, Orchestrator, ConversationEngine) has instantiated test coverage within `src/test/suite`.
