# Verno v1.0 — Requirements

## Milestone Goal
Transform Verno from a working MVP into an industry-grade, publishable VSCode extension with secure credentials, comprehensive test coverage, additional LLM providers, and a polished UX — ready for FYP evaluation and potential marketplace submission.

## Table Stakes (Must Have)

### Security & Credentials
- [ ] **SEC-01** — API keys stored via `vscode.SecretStorage`, never in settings plain-text or memory leak paths
- [ ] **SEC-02** — Webview message handlers validate `message.type` before processing
- [ ] **SEC-03** — CSP headers correct on all webview panels (already partially done — audit all)

### Provider Completeness
- [ ] **PRV-01** — Anthropic Claude provider (`claude-3-5-sonnet`, `claude-3-haiku`) implemented and selectable
- [ ] **PRV-02** — OpenAI provider (`gpt-4o`, `gpt-4o-mini`) implemented and selectable
- [ ] **PRV-03** — Provider selection persisted in SecretStorage (API keys) and settings (model name)

### Test Infrastructure
- [ ] **TST-01** — `MockLLMService` injectable into agents for deterministic unit testing
- [ ] **TST-02** — DeveloperAgent unit tests (code parse, quality check routing)
- [ ] **TST-03** — OrchestratorAgent unit tests (mode routing: ask/plan/code)
- [ ] **TST-04** — ConversationEngine unit tests (history management, context building)
- [ ] **TST-05** — E2E Playwright test: extension activates, panel renders, submit produces response
- [ ] **TST-06** — CI/CD: GitHub Actions workflow runs lint + compile + test on every push

### Extension Polish
- [ ] **EXT-01** — `version` bumped to `0.2.0`, `publisher` set to real identifier
- [ ] **EXT-02** — `logger.show()` removed from activation path (opt-in via command only)
- [ ] **EXT-03** — Agent outputs written to `.verno/` only, never workspace root (remove `IMPLEMENTATION.md` dump)
- [ ] **EXT-04** — Streaming markdown rendering in AgentPanel (bold, code blocks, lists)

### Storage
- [ ] **STR-01** — VectorStore persisted to disk (`~/.verno/index/` or `.verno/index/`) using JSON serialization
- [ ] **STR-02** — Index invalidated and rebuilt on file change events

## Differentiators (Should Have)

- [ ] **DIF-01** — Model selection dropdown in webview (Gemini/Groq/Claude/OpenAI + model tier)
- [ ] **DIF-02** — Token usage display in UI (context window utilization bar)
- [ ] **DIF-03** — CodeReviewAgent integrated into BMAD pipeline post-generation
- [ ] **DIF-04** — Voice wakeword detection ("Hey Verno") via VAD threshold tuning

## Out of Scope (Won't Have in v1.0)
- Self-hosted LLM server — outside extension model
- Multi-workspace concurrent sessions — not needed for FYP
- Plugin marketplace publication — scope ends at installable VSIX
- Collaborative multi-user features — single-user tool

## Acceptance Criteria
All TST-0x requirements have passing tests.  
All SEC-0x requirements verified with threat model walkthrough.  
Extension compiles cleanly (`tsc --noEmit` zero errors).  
ESLint passes with zero errors.  
GitHub Actions green on main branch.  
Manual smoke test: voice → transcription → agent → spoken response — end-to-end works.
