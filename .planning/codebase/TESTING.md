# Verno — Testing State

## Current Coverage

### Unit Tests (`tests/services/`)
| Test File | Status | Coverage |
|-----------|--------|----------|
| FeedbackService.test.ts | ✅ Written | FeedbackService CRUD, severity levels |
| ProgressIndicator.test.ts | ✅ Written | Status bar updates, dispose |
| TodoService.test.ts | ✅ Written | Task creation, priority, dependencies |

### E2E Tests (`tests/e2e/`)
| Test File | Status | Notes |
|-----------|--------|-------|
| example.spec.ts | ⚠️ Skeleton | No real assertions — placeholder only |

### Agent Tests
- ❌ No unit tests for any agent (OrchestratorAgent, DeveloperAgent, etc.)
- ❌ No integration tests for BMAD pipeline

### Service Tests
- ❌ No tests for LLMService / provider logic
- ❌ No tests for ConversationEngine
- ❌ No tests for RAG pipeline (VectorStore, EmbeddingService, ContextEngine)
- ❌ No tests for AudioRouter / LocalWhisperService
- ❌ No tests for Jira integration

## Test Infrastructure
- Runner: `@vscode/test-cli` + `@vscode/test-electron`
- Framework: Mocha (via vscode-test)
- E2E: Playwright `^1.58.2`
- Config: `playwright.config.ts` present

## Gaps & Priorities
1. **Critical** — Agent pipeline has zero test coverage; regressions in code gen are invisible
2. **High** — No integration test for voice→text→LLM→response path
3. **High** — E2E Playwright test is a non-testing skeleton
4. **Medium** — No snapshot tests for webview HTML output
5. **Medium** — Jira integration entirely untested

## Test Strategy Recommendation
- Mock `vscode` module and LLMService for agent unit tests
- Use dependency injection (already partially in place) to swap real services
- Build a `MockLLMService` that returns deterministic responses
- E2E: test the full voice→response flow in a real VSCode window via Playwright
