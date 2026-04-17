# Phase 10 — Research: Security & Compliance (SDLC Phase 8)

## Research Focus
What do I need to know to plan Phase 10: making security left-shifted, production-grade, and actionable in Verno — covering OWASP checklist generation per PRD feature, GDPR/HIPAA compliance flagging, and pre-commit secret scanning?

---

## ## RESEARCH COMPLETE

---

## 1. What Already Exists (Critical — Avoid Duplication)

`DebateOrchestrator.ts` already contains stubs that Phase 10 must **extend**, not replace:

| Existing Symbol | Location | Current State | Phase 10 Upgrade |
|----------------|----------|---------------|-----------------|
| `GDPR_KEYWORDS` | `DebateOrchestrator.ts:27` | 14-entry array, static | Expand + extract to service |
| `HIPAA_KEYWORDS` | `DebateOrchestrator.ts:32` | 10-entry array, static | Expand + regulatory refs |
| `OWASP_BASELINE_CHECKLIST` | `DebateOrchestrator.ts:38` | 6 items, appended globally | Feature-aware per PRD section |
| `detectComplianceFlags()` | `DebateOrchestrator.ts:233` | Section-level scan | Article-level GDPR refs |
| `injectOwaspChecklist()` | `DebateOrchestrator.ts:256` | One global injection | Per-feature contextual OWASP |

**Key insight:** The stubs work but are static and embedded in the orchestrator. Phase 10 extracts them into a dedicated `SecurityComplianceService`, makes them feature-aware, and adds a VSCode command surface.

---

## 2. OWASP Top 10 (2021) — Feature-Aware Mapping

Rather than injecting the same 6 OWASP items into every PRD, Phase 10 maps **feature keywords → relevant OWASP categories**:

| Feature Signal (in PRD text) | Priority OWASP Items |
|------------------------------|---------------------|
| `login`, `auth`, `password`, `session`, `token`, `jwt` | A07 (Auth Failures), A01 (Access Control), A02 (Crypto) |
| `upload`, `file`, `attachment`, `media` | A04 (Insecure Design), A03 (Injection via SSRF), A05 (Misconfiguration) |
| `api`, `endpoint`, `rest`, `graphql`, `webhook` | A01 (Access Control), A03 (Injection), A08 (Integrity Failures) |
| `payment`, `billing`, `stripe`, `card`, `checkout` | A02 (Crypto), A01 (Access Control), A04 (Insecure Design) |
| `admin`, `role`, `permission`, `privilege` | A01 (Access Control), A07 (Auth Failures) |
| `log`, `audit`, `event`, `monitor` | A09 (Logging Failures) |
| `third-party`, `oauth`, `sso`, `saml`, `external` | A08 (Software/Data Integrity), A07 (Auth) |
| (fallback — any feature) | A01, A02, A03, A05, A07, A09 (baseline 6) |

**Implementation:** `SecurityComplianceService.getOwaspItemsForFeature(featureText: string): OwaspItem[]`

---

## 3. GDPR/HIPAA Flagging — Enhancement Plan

### Current gap
`detectComplianceFlags()` returns generic warning strings. Phase 10 adds:
- **GDPR Article references**: Article 6 (lawful basis), Article 13/14 (transparency), Article 17 (erasure), Article 25 (privacy by design), Article 32 (security of processing), Article 33 (breach notification)
- **HIPAA Safeguard references**: Administrative (§164.308), Physical (§164.310), Technical (§164.312)
- **Flag severity levels**: `warn` (PII detected), `error` (health data, no audit log mentioned)
- **Structured output**: `ComplianceFlag` interface with `regulation`, `article`, `severity`, `recommendation`

### Extended keyword sets
```
GDPR additions: 'dob', 'date of birth', 'national id', 'passport', 'biometric', 'geolocation',
                'financial', 'credit', 'bank', 'race', 'religion', 'political', 'sexual orientation'

HIPAA additions: 'PHI', 'protected health', 'medication', 'dosage', 'allergy', 'immunization',
                 'radiology', 'pathology', 'mental health', 'substance abuse', 'genomic'
```

---

## 4. Pre-Commit Secret Scanner — Technical Approach

### Pattern Library (secret-patterns.ts)
Regex patterns to detect credential leaks before commits:

| Secret Type | Pattern Example |
|-------------|----------------|
| AWS Access Key | `/AKIA[0-9A-Z]{16}/` |
| AWS Secret Key | `/[0-9a-zA-Z/+]{40}/` (with context) |
| GitHub Token (classic) | `/ghp_[a-zA-Z0-9]{36}/` |
| GitHub Token (fine-grained) | `/github_pat_[a-zA-Z0-9_]{82}/` |
| Stripe Secret Key | `/sk_live_[a-zA-Z0-9]{24,}/` |
| Stripe Publishable Key | `/pk_live_[a-zA-Z0-9]{24,}/` |
| Google API Key | `/AIza[0-9A-Za-z\-_]{35}/` |
| JWT Token | `/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/` |
| Private Key (PEM) | `/-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/` |
| Connection String w/ password | `/[a-z]+:\/\/[^:]+:[^@]+@/i` |
| Hardcoded password | `/password\s*=\s*["'][^"']{3,}/i` |
| Generic API key assignment | `/api[_-]?key\s*=\s*["'][^"']{8,}/i` |

### Git Hook Injection Strategy
- Write Node.js script to `.git/hooks/pre-commit`
- Hook calls `verno-scan` (or inline Node.js) to scan staged files
- On detection: print offending file + line, exit code 1 (blocks commit)
- Graceful degradation: if `.git/` not found, offer manual scan command only
- Windows compatibility: use Node.js shebang pattern (`#!/usr/bin/env node`) — works via Git for Windows

### VSCode Integration
- Command `verno.scanForSecrets` — scans all workspace files, shows results in output channel
- Command `verno.installSecretScanner` — installs the pre-commit hook
- Command `verno.uninstallSecretScanner` — removes the hook
- Status bar indicator: 🔒 scanner active / ⚠️ scanner not installed

---

## 5. Existing Service Pattern (from Phase 8/9)

All Phase 8/9 services follow this pattern consistently:

```
src/services/project/
  CiCdScaffoldService.ts        ← Phase 8, plan 08-02
  ContainerScaffoldService.ts   ← Phase 8, plan 08-03
  OtelInstrumentationService.ts ← Phase 9, plan 09-01
  GrafanaDashboardService.ts    ← Phase 9, plan 09-01
  RunbookGeneratorService.ts    ← Phase 9, plan 09-02
  templates/
    ci-workflows.ts
    docker-templates.ts
    helm-templates.ts
    otel-templates.ts
    grafana-templates.ts
```

Phase 10 adds:
```
src/services/project/
  SecurityComplianceService.ts  ← plan 10-01
  SecretScannerService.ts       ← plan 10-02
  templates/
    secret-patterns.ts          ← plan 10-02
```

Commands are registered in `extension.ts` and implemented in `src/commands/`.

---

## 6. DebateOrchestrator Integration

`DebateOrchestrator.ts` currently calls `detectComplianceFlags()` and `injectOwaspChecklist()` as private methods. Phase 10:
1. Creates `SecurityComplianceService` with these as public methods (enhanced)
2. `DebateOrchestrator` imports `SecurityComplianceService` and delegates to it
3. Removes the inline private methods
4. The `GDPR_KEYWORDS`, `HIPAA_KEYWORDS`, `OWASP_BASELINE_CHECKLIST` constants move to `SecurityComplianceService`

This maintains backward compatibility — the PRD output remains identical in structure, but the flagging is now richer.

---

## 7. Extension.ts Registration Pattern

From Phase 8 analysis, commands are registered like:
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('verno.commandName', async () => {
    const service = new ServiceClass(workspaceRoot, llmService, logger);
    await service.method();
  })
);
```

Phase 10 registers: `verno.generateOwaspChecklist`, `verno.checkCompliance`, `verno.scanForSecrets`, `verno.installSecretScanner`, `verno.uninstallSecretScanner`

---

## 8. Validation Architecture

### Automated
- `tsc --noEmit` must pass after all changes
- Unit tests: `SecurityComplianceService.getOwaspItemsForFeature()` returns correct OWASP items for known feature signals
- Unit tests: `SecretScannerService.scan()` detects planted test secrets, returns correct file+line
- `SecretScannerService.scan()` returns empty results for clean files

### Manual
- Run `verno.generateOwaspChecklist` inside a PRD debate → Security & Compliance section contains feature-aware OWASP items
- Run `verno.scanForSecrets` on workspace with a planted `TEST_KEY=AIzaSyTest123456789012345678901234567` → detected
- Install hook via `verno.installSecretScanner` → `.git/hooks/pre-commit` exists and is executable
- Attempt git commit with planted secret → commit blocked, message shown

---

## Key Decisions for Planner

1. **Extract, don't replace**: `SecurityComplianceService` enhances DebateOrchestrator's existing logic — backward compatible
2. **VS Code output channel**: All scan results go to the existing `verno` output channel (not a new one)
3. **No new npm dependencies**: Secret scanning uses built-in `fs`, `path`, `child_process` — no `trufflehog` or `gitleaks` dependency needed for FYP scope
4. **Hook file format**: `.git/hooks/pre-commit` written as a Node.js script (cross-platform)
5. **Status bar item**: Reuse existing status bar patterns from extension.ts
