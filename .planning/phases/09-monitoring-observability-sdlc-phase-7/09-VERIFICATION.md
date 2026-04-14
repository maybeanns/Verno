# Phase 09 — Verification: Monitoring & Observability

## Sign-Off Date
2026-04-15

## Requirements Verified

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MON-01 — OpenTelemetry instrumentation auto-added | ✅ PASS | `OtelInstrumentationService` generates stack-aware `instrumentation.ts`/`.py`/`.sh` |
| MON-02 — Grafana dashboard JSON per service | ✅ PASS | `GrafanaDashboardService` writes `.verno/observability/grafana-dashboard.json` with RED panels |
| MON-03 — Runbook from architecture + failure modes | ✅ PASS | `RunbookGeneratorService` produces RUNBOOK.md with 6 built-in + LLM-contextualised scenarios |

## Files Created

| File | Purpose |
|------|---------|
| `src/services/project/templates/otel-templates.ts` | OTel instrumentation templates (TS, Python, Generic) |
| `src/services/project/OtelInstrumentationService.ts` | Stack-aware OTel file generator |
| `src/services/project/templates/grafana-templates.ts` | Grafana dashboard JSON builder |
| `src/services/project/GrafanaDashboardService.ts` | Dashboard generator to `.verno/observability/` |
| `src/services/project/RunbookGeneratorService.ts` | Hybrid (catalogue + LLM) runbook generator |

## Files Modified

| File | Change |
|------|--------|
| `src/extension.ts` | Added imports + registered `verno.generateObservability` command |
| `package.json` | Added `verno.generateObservability` to contributes.commands |
| `.planning/ROADMAP.md` | Phase 9 marked `[x]`, both plans marked `[x]` |

## Integration Points
- `verno.generateObservability` command calls all three services in sequence
- Each service follows the established scaffold pattern from Phase 8
- All outputs go to workspace root (OTel) or `.verno/observability/` (Grafana, Runbook)
