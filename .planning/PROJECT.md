# Verno — Project Context

## What This Is

Verno is a **VSCode extension** that automates the entire Software Development Life Cycle (SDLC) — from initial idea to deployed, monitored, and documented software — using a multi-agent AI pipeline. It operates in two distinct modes:

### 🗣 Conversational Mode
A persistent AI partner in your sidebar that gives real-time:
- **Vulnerability alerts** as you write code
- **Architectural suggestions** based on your workspace context
- **Requirement clarifications** and ambiguity detection
- **Sprint planning advice** and estimation guidance
- **Documentation drift alerts** when code and docs diverge

### ⚙️ Development Mode
A full automated SDLC pipeline triggered by a topic/feature request:
1. **Requirements** → AI debate → PRD with ambiguity flags and traceability matrix
2. **Planning** → Story point estimation → Sprint plan → Dependency graph
3. **Architecture** → ADRs + Mermaid diagrams + OpenAPI contracts
4. **Code Generation** → Multi-agent parallel generation + self-healing + conflict resolution
5. **Testing** → Unit test auto-gen + E2E scaffolding + coverage badges
6. **CI/CD** → GitHub Actions + Dockerfile + Kubernetes manifests
7. **Monitoring** → OpenTelemetry instrumentation + Grafana dashboards + runbooks
8. **Security** → OWASP checklists + GDPR/HIPAA flags + secret scanning
9. **Documentation** → Auto-synced README + changelog generation + JSDoc

## Core Value

**"Zero to deployed" in one VSCode extension** — Verno owns every SDLC phase so developers can stay in flow without context-switching between tools.

## Target Users
- Solo developers who want a complete AI co-pilot for new projects
- Small teams who want automated SDLC structure without enterprise PM overhead
- FYP/academic projects that need to demonstrate full engineering rigour

## Current State (Brownfield Baseline)

### What Works (Validated)
- ✅ 7-agent debate system (Analyst, Architect, UX, Developer, PM, QA, TechWriter)
- ✅ PRD generation from debate convergence (JSON → Markdown)
- ✅ Jira Epic/Story/Subtask sync (full CRUD via REST API)
- ✅ BMAD code generation pipeline with quality checks
- ✅ RAG-based context retrieval (VectorStore + import graph + tiered context)
- ✅ Voice input (VAD + Local Whisper + Groq cloud fallback)
- ✅ TTS response (Kokoro local)
- ✅ Conversation persistence in `.verno/`
- ✅ Plan state persistence with timestamped backups (`PlanStateService`)
- ✅ FeedbackService + TodoService + ProgressIndicator
- ✅ Enhanced sidebar (TODOs / Feedback / Conversations tabs)

### Critical Missing Pieces
- ❌ **Security persona** missing from debate (8-agent should include Security)
- ❌ **Story point estimation** — `storyPoints` field exists in `Story` type but no agent sets it
- ❌ **Sprint auto-planner** — no capacity-based sprint distribution
- ❌ **Self-healing code gen** — DeveloperAgent detects errors but does not retry/fix
- ❌ **GitHub integration** — no repo detection, no PR creation, no Actions scaffolding
- ❌ **Phases 6–9 entirely absent** (CI/CD, Monitoring, Security, Documentation)
- ❌ **Conversational mode** is basic chat — not a true SDLC-aware advisor
- ❌ **ADRs and Mermaid diagrams** not generated despite ArchitectAgent existing
- ❌ **PRD version diffing** — no revision tracking
- ❌ **Ambiguity auto-detector** — no vague requirement flagging
- ❌ API keys not stored securely (SecretStorage gap)
- ❌ No Anthropic/OpenAI providers despite config entries
- ❌ Zero agent unit test coverage
- ❌ No CI/CD for Verno itself

## Requirements

### Validated (Already Implemented)
- ✓ Multi-agent debate → PRD — existing
- ✓ Jira sync (Epics/Stories/Subtasks) — existing
- ✓ BMAD code generation with quality checks — existing
- ✓ RAG tiered context engine — existing
- ✓ Voice STT + TTS pipeline — existing
- ✓ Plan state persistence — existing

### Active (Must Implement — v1.0)

**Mode Architecture**
- [ ] **MOD-01** — Conversational mode\: SDLC-aware advisor with real-time workspace analysis
- [ ] **MOD-02** — Development mode: full 9-phase pipeline with phase gating and progress tracking

**Phase 1 — Requirements & PRD**
- [ ] **PRD-01** — Security persona added as 8th debate agent (OWASP + GDPR focus)
- [ ] **PRD-02** — Ambiguity auto-detector: flags vague requirements (e.g. "should be fast", "easy to use")
- [ ] **PRD-03** — PRD version diffing: show what changed between revision rounds
- [ ] **PRD-04** — Requirements traceability matrix: link PRD sections → Epics

**Phase 2 — Planning & Estimation**
- [ ] **PLN-01** — Story point estimation agent (Fibonacci sizing via dedicated sub-agent)
- [ ] **PLN-02** — Dependency graph: which stories block which (visualized in sidebar)
- [ ] **PLN-03** — Sprint auto-planner: distribute stories across sprints by capacity input

**Phase 3 — Architecture & Design**
- [ ] **ARC-01** — Architecture Decision Records (ADRs) per design choice from ArchitectAgent
- [ ] **ARC-02** — Auto-generated Mermaid diagrams (sequence, component, ER diagrams)
- [ ] **ARC-03** — OpenAPI contract designer for API-first projects

**Phase 4 — Code Generation (Self-Healing)**
- [ ] **COD-01** — Self-healing: detect TypeScript/ESLint errors post-gen and re-run with error context
- [ ] **COD-02** — Multi-agent conflict resolver: detect when two agents edit same file → merge
- [ ] **COD-03** — Incremental diff generation: only regenerate changed sections

**Phase 5 — Testing & QA**
- [ ] **TST-01** — Unit test auto-generator: per-file test stubs after code generation
- [ ] **TST-02** — E2E test scaffolding: Playwright test files generated per user flow
- [ ] **TST-03** — Coverage badge in sidebar (live refresh after test run)
- [ ] **TST-04** — MockLLMService + agent unit tests (≥80% coverage on critical agents)

**Phase 6 — CI/CD & DevOps**
- [ ] **CIC-01** — GitHub Actions workflow scaffolding (lint→test→build→deploy)
- [ ] **CIC-02** — Dockerfile + docker-compose generation per detected stack
- [ ] **CIC-03** — Kubernetes manifest generation for containerized services
- [ ] **CIC-04** — GitHub repository integration (detect repo, branch, PR creation)

**Phase 7 — Monitoring & Observability**
- [ ] **MON-01** — OpenTelemetry instrumentation snippets auto-added to generated services
- [ ] **MON-02** — Grafana dashboard scaffold (JSON) per generated service
- [ ] **MON-03** — Runbook generator from architecture + common failure modes

**Phase 8 — Security & Compliance**
- [ ] **SEC-01** — OWASP checklist generated per feature/PRD
- [ ] **SEC-02** — GDPR/HIPAA concern flags in PRD (auto-detected from data fields)
- [ ] **SEC-03** — Secret scanning before any git commit (blocks push if secrets detected)
- [ ] **SEC-04** — API key storage via VSCode SecretStorage (Verno's own credentials)
- [ ] **SEC-05** — Webview message type validation (security boundary)

**Phase 9 — Documentation**
- [ ] **DOC-01** — Auto-sync README sections when relevant code changes
- [ ] **DOC-02** — Changelog generation from Conventional Commits
- [ ] **DOC-03** — JSDoc/TSDoc generation from BMAD-generated code

**Extension & Provider Quality**
- [ ] **EXT-01** — Anthropic Claude provider (claude-3-5-sonnet, claude-3-haiku)
- [ ] **EXT-02** — OpenAI provider (gpt-4o, gpt-4o-mini)
- [ ] **EXT-03** — Streaming markdown renderer in chat (marked.js + highlight.js)
- [ ] **EXT-04** — Extension version 0.2.0, publisher set, logger not auto-opened

### Out of Scope (v1.0)
- Self-hosted LLM server — outside extension model
- Multi-user collaborative sessions — single-developer tool for FYP
- Full marketplace publication — scope ends at installable VSIX + FYP evaluation

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| 9-phase SDLC framework | Covers full lifecycle; differentiates from simple code-gen tools | ✅ Decided |
| Two modes (Conversational + Development) | Conversational = always-on advisor; Development = triggered pipeline | ✅ Decided |
| Security as 8th debate persona | OWASP/GDPR concerns caught at PRD stage, not post-code | ✅ Decided |
| Self-healing code gen | Error → re-gen loop eliminates manual fix-compile-retry cycle | ✅ Decided |
| GitHub integration first for CI/CD | Repo detection + Actions scaffolding = biggest leverage | ✅ Decided |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-14 after product vision expansion to 9-phase SDLC*
