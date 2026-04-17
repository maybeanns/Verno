# Phase 09 — Monitoring & Observability (SDLC Phase 7: Context)

## Phase Goal
Generated code ships with generated observability — OpenTelemetry instrumentation snippets, Grafana dashboard JSON scaffolds, and operational runbooks.

## Requirements Addressed
- **MON-01** — OpenTelemetry instrumentation snippets auto-added to generated services
- **MON-02** — Grafana dashboard scaffold (JSON) per generated service
- **MON-03** — Runbook generator from architecture + common failure modes

## Implementation Decisions

### D-01: Template-Based OTel Instrumentation
- Use the same template pattern established by `CiCdScaffoldService` and `ContainerScaffoldService`.
- Create `OtelInstrumentationService` that produces stack-aware OTel boilerplate.
- For TypeScript/Node: produce an `instrumentation.ts` file with `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, and a console/OTLP exporter.
- For Python: produce an `instrumentation.py` with `opentelemetry-sdk` + `opentelemetry-instrumentation`.
- Generic fallback: produce a shell-script entrypoint wrapper with env-var-based OTel agent.

### D-02: Grafana Dashboard JSON Generator
- Create `GrafanaDashboardService` that generates a portable `grafana-dashboard.json` file.
- Dashboard includes: HTTP request rate, error rate, and latency percentile panels.
- Parameterised by `serviceName` from `WorkspaceSnapshot`.
- Output to `.verno/observability/grafana-dashboard.json`.

### D-03: Runbook Generator
- Create `RunbookGeneratorService` that produces a Markdown runbook.
- Sources failure modes from `ARCHITECTURE.md` (if present) plus a built-in catalogue of common failure types (OOM, connection refused, TLS expiry, rate-limiting).
- Output to `.verno/observability/RUNBOOK.md`.

### D-04: Registration in Extension
- Register all three services in the Orchestrator's BMAD pipeline so they run automatically after CI/CD scaffolding (Phase 8 → Phase 9 sequencing).
- Expose a manual command `verno.generateObservability` for on-demand generation.

## Prior Art (Phase 8 Pattern)
Phase 8 established the canonical scaffold pattern:
1. A `*Service.ts` class in `src/services/project/` with a `generate*()` method.
2. Template strings in `src/services/project/templates/*.ts`.
3. Stack detection via `WorkspaceSnapshot` from `WorkspaceIntelligence`.
4. Files written to project root or `.verno/` directory.

Phase 9 will follow this exact pattern.
