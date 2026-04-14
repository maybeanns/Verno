# Phase 09 — Research: Monitoring & Observability

## Research Focus
How to scaffold production-grade observability artifacts (OTel, Grafana, runbooks) for generated services, following the same template pattern established in Phase 8.

## Dependencies & Ecosystem

### OpenTelemetry (Node.js)
- `@opentelemetry/sdk-node` — unified SDK setup (TracerProvider, MeterProvider, LoggerProvider)
- `@opentelemetry/auto-instrumentations-node` — zero-code HTTP, Express, pg, redis instrumentation
- `@opentelemetry/exporter-trace-otlp-http` — sends traces to any OTLP-compatible backend
- `@opentelemetry/exporter-metrics-otlp-http` — sends metrics to Prometheus/Grafana Cloud
- Minimal setup: ~20 lines of `instrumentation.ts` imported before app entry

### OpenTelemetry (Python)
- `opentelemetry-sdk`, `opentelemetry-api` — core SDK
- `opentelemetry-instrumentation` — auto-instrumentation (Flask, Django, FastAPI, requests)
- `opentelemetry-exporter-otlp` — OTLP exporter
- Minimal setup: ~15 lines of `instrumentation.py`

### Grafana Dashboard JSON Model
- Grafana dashboard JSON is a well-documented schema
- Panels: `graph`, `stat`, `table`, `timeseries`
- Data sources configured via `${DS_PROMETHEUS}` templating variable
- Standard RED metrics: Rate, Errors, Duration

### Runbook Standards
- Google SRE Runbook format: Title → Impact → Detection → Diagnosis → Mitigation → Prevention
- Can be generated from ARCHITECTURE.md (failure modes) + common operational patterns

## Existing Patterns in Verno (Phase 8)

| Service | Template Source | Output Path |
|---------|---------------|-------------|
| `CiCdScaffoldService` | `templates/ci-workflows.ts` | `.github/workflows/ci.yml` |
| `ContainerScaffoldService` | `templates/docker-templates.ts` + `templates/helm-templates.ts` | `Dockerfile`, `docker-compose.yml`, `helm/` |

Phase 9 will add:

| Service | Template Source | Output Path |
|---------|---------------|-------------|
| `OtelInstrumentationService` | `templates/otel-templates.ts` | `instrumentation.ts` or `instrumentation.py` |
| `GrafanaDashboardService` | `templates/grafana-templates.ts` | `.verno/observability/grafana-dashboard.json` |
| `RunbookGeneratorService` | LLM-assisted + built-in catalogue | `.verno/observability/RUNBOOK.md` |

## Key Insight
Unlike CI/CD templates (which are static), **runbooks benefit from LLM generation** since they need to be contextualised to the project's architecture. We'll use a hybrid approach: static failure catalogue + LLM contextualisation from ARCHITECTURE.md.
