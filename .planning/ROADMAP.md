# Verno v1.0 — Roadmap

## Milestone: Industry-Grade Foundation

**Goal:** Harden Verno from working MVP to industry-grade VSCode extension — secure credentials, multi-provider LLM support, comprehensive tests, CI/CD, and polished UX.

**Target:** FYP evaluation ready + potential VSCode Marketplace submission.

---

## Phase 1 — Security & Extension Foundation
**Goal:** Fix critical security issues and extension metadata. No-regression baseline.

**Depends on:** Codebase map (done)

### Plans
1. **Secure API Key Storage** — Migrate all API keys from inputBox to `vscode.SecretStorage`. Add `getApiKey()` / `storeApiKey()` helpers in ConfigService. Update all providers. [SEC-01]
2. **Webview Message Security** — Add `message.type` validation + allowlist in AgentPanel, EnhancedSidebarProvider, SDLCWebviewPanel. [SEC-02, SEC-03]
3. **Extension Metadata & Logger Polish** — Bump version to `0.2.0`, set publisher, remove auto `logger.show()`, suppress `IMPLEMENTATION.md` workspace dump, route all agent output to `.verno/`. [EXT-01, EXT-02, EXT-03]

**UAT:** API keys are not prompted via dialog on fresh install; stored keys persist across restarts. Webview rejects unknown message types. Output channel not auto-opened.

---

## Phase 2 — Multi-Provider LLM Support
**Goal:** Implement Anthropic and OpenAI providers; add model selection UI.

**Depends on:** Phase 1 (SecretStorage in place)

### Plans
1. **Anthropic Provider** — Implement `AnthropicProvider` using `@anthropic-ai/sdk`. Support `claude-3-5-sonnet-20241022` and `claude-3-haiku-20240307`. Wire streaming. [PRV-01]
2. **OpenAI Provider** — Implement `OpenAIProvider` using `openai` SDK. Support `gpt-4o` and `gpt-4o-mini`. Wire streaming. [PRV-02]
3. **Provider Selection UI** — Add model/provider selector dropdown to AgentPanel webview. Persist choice to VSCode settings. Show active model in status bar. [PRV-03, DIF-01]

**UAT:** User can switch between Gemini/Groq/Anthropic/OpenAI in dropdown. Agents respond using selected provider. Token usage visible. [DIF-02]

---

## Phase 3 — Test Infrastructure & Coverage
**Goal:** Establish MockLLMService, write unit tests for critical agents and services, fix Playwright E2E skeleton.

**Depends on:** Phase 1 (clean extension base), Phase 2 (providers stable)

### Plans
1. **MockLLMService & Test Harness** — Create `MockLLMService` implementing `ILLMService`. Add `createMockContext()` factory. Establish test helpers in `tests/helpers/`. [TST-01]
2. **Agent Unit Tests** — Tests for DeveloperAgent (parseCodeFiles, quality check routing), OrchestratorAgent (mode routing), ConversationEngine (history, context building). [TST-02, TST-03, TST-04]
3. **E2E Playwright Tests** — Real assertions: extension activates, AgentPanel renders, text input produces assistant response, conversation persists to disk. [TST-05]

**UAT:** `npm test` passes all tests. Coverage report shows ≥80% on agents/services.

---

## Phase 4 — Persistent Vector Store & RAG Hardening
**Goal:** Replace in-memory VectorStore with disk-backed persistence. Add file-change invalidation.

**Depends on:** Phase 3 (tests cover RAG pipeline before refactor)

### Plans
1. **Disk-Backed VectorStore** — Serialize index to `.verno/index/vectors.json` on write. Load on init. LRU eviction for memory cap. [STR-01]
2. **File Change Invalidation** — `vscode.workspace.createFileSystemWatcher` invalidates index entries on file save/delete. Triggers incremental re-index. [STR-02]
3. **RAG Quality Improvements** — Add re-ranking pass (BM25 + cosine hybrid). Limit context to top-K chunks with token budget awareness. Add telemetry logging for retrieval quality.

**UAT:** After restart, RAG context retrieved without re-indexing wait. Index updates within 2s of file save.

---

## Phase 5 — CI/CD Pipeline & Markdown Streaming UI
**Goal:** GitHub Actions CI pipeline + streaming markdown in chat panel.

**Depends on:** Phase 3 (tests must pass in CI)

### Plans
1. **GitHub Actions CI** — Workflow: `lint → compile → unit-test → e2e-test` on push/PR to main. Cache node_modules. Upload test results artifact. [TST-06]
2. **Streaming Markdown Renderer** — Replace plain-text `addMessage()` with `marked.js` rendering. Support: fenced code blocks with syntax highlight (highlight.js), bold, italic, lists, tables. Stream tokens into DOM progressively. [EXT-04]
3. **CodeReviewAgent Integration** — Wire `CodeReviewAgent` into BMAD pipeline: runs after `DeveloperAgent`, before `TechWriterAgent`. Output appended to feedback panel. [DIF-03]

**UAT:** GitHub Actions green on clean push. Code blocks render with syntax highlighting. AI review visible in Feedback tab after code generation.

---

## Phase 6 — Polish, Documentation & VSIX Package
**Goal:** FYP-ready deliverable — polished UX, comprehensive docs, packaged VSIX.

**Depends on:** All prior phases

### Plans
1. **UX Polish Pass** — Onboarding flow for first-time users (API key setup wizard). Keyboard shortcut for voice start/stop. Welcome page with quick-start guide.
2. **Documentation** — Update README with full feature set, architecture diagram, setup guide. Add CONTRIBUTING.md, CHANGELOG.md with real entries. JSDoc all public interfaces.
3. **Package & Validate** — `vsce package` → produce final `.vsix`. Validate in clean VSCode install. Verify all features work end-to-end. Update `version` to `1.0.0`.

**UAT:** Fresh VSCode install of VSIX works with zero manual config beyond API key entry. All README features functional.

---

## Progress Summary

| Phase | Status | Key Deliverable |
|-------|--------|-----------------|
| Phase 1 — Security | 🔲 Not started | SecretStorage, webview guards, metadata |
| Phase 2 — Multi-Provider | 🔲 Not started | Anthropic + OpenAI providers |
| Phase 3 — Tests | 🔲 Not started | MockLLM + agent unit tests + E2E |
| Phase 4 — Persistent RAG | 🔲 Not started | Disk-backed VectorStore |
| Phase 5 — CI + Markdown | 🔲 Not started | GitHub Actions + streaming UI |
| Phase 6 — Polish + VSIX | 🔲 Not started | Final FYP deliverable |
