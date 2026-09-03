# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through [GitHub Security Advisories](https://github.com/maybeanns/Verno/security/advisories/new). Include what you found, how to reproduce it, and what an attacker could do with it. Expect an initial response within a week.

## Scope

Verno runs AI-generated code and talks to third-party LLM providers. A few things are known and by design rather than vulnerabilities:

- **Generated code is not sandboxed.** The extension's self-healing loop runs `npm install`, your test scripts, and lint against generated output. Review before running it anywhere you care about.
- **The web app's preview runs client-side** via Sandpack, in the browser's own iframe sandbox. It does not execute a real backend.
- **Bring-your-own API keys** are held by the caller. The extension stores them in VS Code SecretStorage; the web app keeps them in the browser and forwards them per request.

Reports we want: credential leaks, authentication or authorization bypass in the web app, injection into generated artifacts that escapes the intended boundary, and anything that exposes one user's data to another.

## Secrets

If you find a live credential committed anywhere in this repository, report it privately as above. Do not open a PR that merely deletes it — the value stays in git history and must be rotated at the provider first.
