# Verno — Project Context

## What This Is

Verno is a **VSCode extension** that brings multi-agent AI orchestration directly into the developer's editor. Users speak or type a request; Verno routes it through a specialized agent pipeline (Analyst → Architect → UX → Developer → QA → TechWriter), generates and writes code, and speaks the response back. It also includes an SDLC workflow (AI debate → PRD generation → Jira sync) for larger feature planning.

The project is a **Final Year Project (FYP)** that must demonstrate industry-grade engineering quality.

## Core Value

A voice-first, multi-agent AI coding assistant that handles the full SDLC — from requirement debate to production code — without leaving VSCode.

## Current State (Brownfield Baseline)

### What Works
- ✅ Multi-agent BMAD pipeline (Analyst, Architect, UX, Developer, QA, TechWriter)
- ✅ Voice input via VAD + Local Whisper + Groq fallback
- ✅ TTS response via Kokoro (local)
- ✅ SDLC flow: debate → PRD → Jira sync
- ✅ RAG pipeline: VectorStore + Import graph + tiered context retrieval
- ✅ Conversation persistence in `.verno/`
- ✅ Enhanced sidebar with TODOs, Feedback, Conversations tabs
- ✅ Progress tracking in activity bar

### Critical Gaps (Must Fix for Industry Grade)
- ❌ API keys entered via dialog — not stored securely (VSCode SecretStorage)
- ❌ Anthropic/OpenAI providers advertised but not implemented
- ❌ VectorStore in-memory only — no persistence between sessions
- ❌ Agent pipeline has zero test coverage
- ❌ E2E tests are non-testing skeletons
- ❌ No CI/CD pipeline
- ❌ `publisher: "yourname"` and `version: "0.0.1"` not updated
- ❌ `logger.show()` auto-opens Output panel (bad UX)
- ❌ `IMPLEMENTATION.md` written to user workspace root — intrusive
- ❌ No error handling on webview message boundaries

## Requirements

### Validated (Already Implemented)
- ✓ Multi-agent BMAD pipeline — existing
- ✓ Local Whisper STT with VAD — existing
- ✓ TTS voice response (Kokoro) — existing
- ✓ SDLC debate → PRD generation — existing
- ✓ Jira Epic/Story sync — existing
- ✓ RAG-based context retrieval for code generation — existing
- ✓ Conversation persistence — existing
- ✓ FeedbackService with severity levels — existing
- ✓ TodoService with priorities — existing
- ✓ ProgressIndicator in activity bar — existing

### Active (Must Implement)
- [ ] Secure API key storage via VSCode SecretStorage
- [ ] Anthropic Claude provider implementation
- [ ] OpenAI provider implementation
- [ ] Persistent VectorStore (disk-backed via SQLite or JSON)
- [ ] Agent unit tests with MockLLMService (≥80% coverage on critical agents)
- [ ] Real E2E Playwright tests with assertions
- [ ] GitHub Actions CI pipeline (lint → compile → test)
- [ ] Extension version and publisher properly set
- [ ] ChatGPT-style streaming UI with markdown rendering
- [ ] Settings UI for API keys within VSCode settings (not input box)
- [ ] Error boundaries on all webview message handlers
- [ ] Remove auto-open logger from activation
- [ ] Output isolation: agent artifacts go to `.verno/` not workspace root

### Out of Scope (v1.0)
- Multi-workspace concurrent sessions — complexity vs value not justified yet
- Self-hosted LLM server hosting — outside extension scope
- Marketplace publication — FYP scope ends at installable VSIX

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local Whisper first | Privacy + latency for common dev commands | Keep — working |
| In-memory VectorStore | No external dep for MVP | Upgrade to persistent in Phase 4 |
| Webview-based UI | Rich chat UX impossible with native VSCode | Keep |
| BMAD agent pipeline | Comprehensive coverage of dev lifecycle | Keep + add tests |
| Provider abstraction (LLMService) | Swap providers without re-wiring | Keep + add Anthropic/OpenAI |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-14 after brownfield initialization*
