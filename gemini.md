# Project Instructions for Claude

## Project Overview
Verno is a VSCode extension that automates the entire Software Development Life Cycle (SDLC) using a multi-agent AI pipeline. It operates in two modes: Conversational (real-time SDLC advisor) and Development (full 9-phase automated pipeline). The goal is "zero to deployed" in one VSCode extension for solo developers and small teams.

## Tech Stack
- TypeScript
- VSCode Extension API
- Anthropic Claude, OpenAI (gpt-4o)
- Whisper + Groq (STT), Kokoro (TTS)
- Jira REST API

## Project Structure
- `/src/agents/` — Multi-agent debate system
- `/src/services/` — Core services (PlanStateService, FeedbackService, RAG engine)
- `/src/webview/` — Sidebar UI
- `/src/providers/` — LLM provider implementations
- `/.planning/` — Project planning docs

## Coding Conventions
- Use TypeScript with strict null checks
- Agent implementations follow multi-agent debate pattern
- Service classes handle state persistence and integrations
- Webview communication uses typed message contracts

## Rules (Do Not Break)
- 9-phase SDLC must be respected: Requirements → Planning → Architecture → Code Gen → Testing → CI/CD → Monitoring → Security → Documentation
- Self-healing code gen is mandatory: DeveloperAgent must detect errors and retry with error context
- Security persona required: 8-agent debate must include Security (OWASP/GDPR focus)

## Common Commands
- Dev: `npm run dev`
- Test: `npm run test`
- Build: `npm run build`

## Current Focus
v1.0 Implementation — Building out the 9-phase SDLC pipeline. Currently working on Phases 1–5 (Requirements, Planning, Architecture, Code Gen, Testing). Phases 6–9 (CI/CD, Monitoring, Security, Documentation) are absent.

## Known Issues / Gotchas
- Story point estimation not implemented — needs dedicated sub-agent
- Self-healing code gen not implemented — DeveloperAgent detects errors but doesn't retry
- GitHub integration missing — needed for Phase 6
- Conversational mode is basic chat, not true SDLC-aware advisor
- ADRs and Mermaid diagrams not generated despite ArchitectAgent existing
- API key storage uses insecure method — needs VSCode SecretStorage integration
- Zero agent unit test coverage — critical agents need ≥80% coverage
