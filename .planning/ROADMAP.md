# Roadmap: Verno

## Overview

Transform Verno from a working MVP into an industry-grade, publishable VSCode extension. Six phases move through security hardening, multi-provider LLM support, comprehensive test coverage, persistent RAG storage, CI/CD automation, and final polish for FYP evaluation and marketplace readiness.

## Phases

- [ ] **Phase 1: Security & Extension Foundation** - Secure credentials, webview guards, extension metadata polish
- [ ] **Phase 2: Multi-Provider LLM Support** - Anthropic + OpenAI providers, model selection UI
- [ ] **Phase 3: Test Infrastructure & Coverage** - MockLLMService, agent unit tests, real E2E tests
- [ ] **Phase 4: Persistent Vector Store & RAG Hardening** - Disk-backed VectorStore, file-change invalidation
- [ ] **Phase 5: CI/CD Pipeline & Streaming Markdown UI** - GitHub Actions CI, streaming markdown renderer
- [ ] **Phase 6: Polish, Documentation & VSIX Package** - UX polish, docs, final package

## Phase Details

### Phase 1: Security & Extension Foundation
**Goal**: Fix critical security issues and extension metadata. Establish a clean, no-regression baseline.
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, EXT-01, EXT-02, EXT-03
**Success Criteria** (what must be TRUE):
  1. API keys are stored via VSCode SecretStorage — never prompted via dialog on repeat sessions
  2. Webview message handlers reject unknown message types
  3. Extension output channel does not auto-open on activation
  4. Agent artifacts write to `.verno/` only, not workspace root
  5. Extension version is 0.2.0, publisher is set correctly
**Plans**: 3 plans

Plans:
- [ ] 01-01: Secure API Key Storage — migrate keys to vscode.SecretStorage
- [ ] 01-02: Webview Message Security — validate message.type in all panels
- [ ] 01-03: Extension Metadata & Logger Polish — version bump, remove logger.show(), fix output paths

### Phase 2: Multi-Provider LLM Support
**Goal**: Implement Anthropic and OpenAI providers; surface provider/model selection in the UI.
**Depends on**: Phase 1
**Requirements**: PRV-01, PRV-02, PRV-03, DIF-01, DIF-02
**Success Criteria** (what must be TRUE):
  1. User can select Gemini / Groq / Anthropic / OpenAI from a dropdown in the chat panel
  2. Selected model persists across extension restarts
  3. Agents respond correctly using the chosen provider
  4. Token usage counter visible in the UI
**Plans**: 3 plans

Plans:
- [ ] 02-01: Anthropic Claude Provider — full streaming implementation
- [ ] 02-02: OpenAI Provider — full streaming implementation
- [ ] 02-03: Provider Selection UI — model dropdown in AgentPanel, persist to settings

### Phase 3: Test Infrastructure & Coverage
**Goal**: Establish injectable mock LLM, write agent/service unit tests, fix Playwright E2E skeleton.
**Depends on**: Phase 1
**Requirements**: TST-01, TST-02, TST-03, TST-04, TST-05
**Success Criteria** (what must be TRUE):
  1. `npm test` passes all unit tests with zero failures
  2. DeveloperAgent, OrchestratorAgent, ConversationEngine have meaningful test cases
  3. Playwright E2E test: extension activates, panel renders, submit returns a response
  4. Coverage report shows ≥80% on critical agents and services
**Plans**: 3 plans

Plans:
- [ ] 03-01: MockLLMService & Test Harness — injectable mock, test helpers, factories
- [ ] 03-02: Agent Unit Tests — DeveloperAgent, OrchestratorAgent, ConversationEngine
- [ ] 03-03: E2E Playwright Tests — real assertions for activation + chat flow

### Phase 4: Persistent Vector Store & RAG Hardening
**Goal**: Replace in-memory VectorStore with disk-backed persistence; add file-change invalidation.
**Depends on**: Phase 3
**Requirements**: STR-01, STR-02
**Success Criteria** (what must be TRUE):
  1. After extension restart, RAG context retrieved without cold-start re-indexing delay
  2. Index updates within 2s of file save
  3. Existing unit tests for RAG pipeline still pass
**Plans**: 3 plans

Plans:
- [ ] 04-01: Disk-Backed VectorStore — JSON serialization to .verno/index/vectors.json
- [ ] 04-02: File Change Invalidation — FileSystemWatcher triggers incremental re-index
- [ ] 04-03: RAG Quality Improvements — hybrid BM25+cosine ranking, token-budget context trimming

### Phase 5: CI/CD Pipeline & Streaming Markdown UI
**Goal**: GitHub Actions CI pipeline + streaming markdown rendering in chat panel.
**Depends on**: Phase 3
**Requirements**: TST-06, EXT-04, DIF-03
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow runs lint → compile → test on every push/PR to main
  2. Code blocks in chat panel render with syntax highlighting
  3. AI code review result visible in Feedback tab after code generation
**Plans**: 3 plans

Plans:
- [ ] 05-01: GitHub Actions CI — lint + compile + unit-test + e2e workflow
- [ ] 05-02: Streaming Markdown Renderer — marked.js + highlight.js in AgentPanel
- [ ] 05-03: CodeReviewAgent Integration — wire into BMAD pipeline post-DeveloperAgent

### Phase 6: Polish, Documentation & VSIX Package
**Goal**: FYP-ready deliverable with polished UX, comprehensive docs, and packaged VSIX.
**Depends on**: Phase 4, Phase 5
**Requirements**: All remaining
**Success Criteria** (what must be TRUE):
  1. Fresh VSIX install works end-to-end with zero manual config beyond API key entry
  2. README accurately documents all features with architecture diagram
  3. `vsce package` produces a valid `.vsix` at version 1.0.0
  4. Manual smoke test: voice → transcript → agent response → TTS playback — works end-to-end
**Plans**: 3 plans

Plans:
- [ ] 06-01: UX Polish — onboarding wizard, keyboard shortcuts, welcome page
- [ ] 06-02: Documentation — README update, CONTRIBUTING.md, JSDoc all public APIs
- [ ] 06-03: Package & Validate — vsce package, smoke test, version bump to 1.0.0

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security & Extension Foundation | 0/3 | Not started | - |
| 2. Multi-Provider LLM Support | 0/3 | Not started | - |
| 3. Test Infrastructure & Coverage | 0/3 | Not started | - |
| 4. Persistent Vector Store & RAG Hardening | 0/3 | Not started | - |
| 5. CI/CD Pipeline & Streaming Markdown UI | 0/3 | Not started | - |
| 6. Polish, Documentation & VSIX Package | 0/3 | Not started | - |
