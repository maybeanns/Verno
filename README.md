# Verno

An open-source AI app builder. Describe what you want to build, and a panel of eight AI agents argues it into a spec before any code is written — then generates the app and previews it live in the browser.

[![CI](https://github.com/maybeanns/Verno/actions/workflows/ci.yml/badge.svg)](https://github.com/maybeanns/Verno/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> **Status:** early and incomplete. Verno started as a final-year project. It builds and runs, but see [Where it stands](#where-it-stands) before comparing it to a commercial product.

## What makes it different

Tools like Lovable, Bolt and Emergent send your prompt straight to a model and start writing files. Verno puts a debate in front of that step.

Eight agents — Analyst, Architect, UX, Developer, PM, QA, Tech Writer, and Security — argue over your idea for three rounds, then synthesize a PRD. The Security agent raises OWASP and GDPR/HIPAA concerns while the thing is still a requirement, which is the cheapest point to fix them. You see the whole argument, and the PRD is an artifact you can edit rather than a hidden prompt.

Code generation then works from that PRD instead of from the original one-line prompt.

## Where it stands

Being straight about the gap, because it decides whether this is useful to you today:

| | Verno | Lovable / Bolt |
|---|---|---|
| Agent debate → editable PRD | Yes | No |
| Live preview | Sandpack, client-side only | Real containers (WebContainers / backend) |
| Backend, DB, `npm install` in preview | No | Yes |
| Deploy | Not yet | One click |
| GitHub export | Not yet | Yes |
| Self-hosted | Yes | No |

The execution substrate is the real gap. Sandpack renders a frontend in the browser; it does not run a server. Moving to WebContainers or a container backend is the single largest open item.

## Repository layout

This is an npm workspaces monorepo.

```
apps/
  web/          Next.js app — the product
  extension/    VS Code extension — the same agents, inside your editor
packages/
  agents/       Canonical agent personas and debate contracts
  llm/          Provider registry and model catalog
scripts/        Build tooling
```

The two apps share `packages/agents` and `packages/llm` so the debate behaves the same in both places. It used to be copy-pasted, and the two copies had quietly drifted apart.

## Quick start

Requires Node.js 18+.

```bash
git clone https://github.com/maybeanns/Verno.git
cd Verno
npm ci
npm run build:packages
```

**Web app:**

```bash
cp apps/web/.env.example apps/web/.env.local   # add your keys
npm run dev:web
```

Supabase and Cloudflare Turnstile are optional. Without them, accounts and the shared free tier are disabled and everyone brings their own API key — which is the self-hosted path anyway.

**VS Code extension:**

```bash
npm run compile -w verno
```

Open `apps/extension` in VS Code and press `F5` for the Extension Development Host. To build an installable `.vsix` into `dist/`:

```bash
npm run package:extension
```

## Providers

Groq, OpenAI, Google, Anthropic, Qwen, Mistral, Moonshot, MiniMax, and DeepSeek, defined in [packages/llm/src/providers.ts](packages/llm/src/providers.ts). Bring your own key for any of them.

The extension stores keys in VS Code SecretStorage. The web app keeps them in the browser and forwards them per request; they are never written to the server.

## Scripts

| Command | Does |
|---|---|
| `npm run build:packages` | Build the shared packages (run this first) |
| `npm run dev:web` | Web app dev server |
| `npm run build:web` | Production build of the web app |
| `npm run compile -w verno` | Compile the extension |
| `npm test -w verno` | Extension test suite |
| `npm run package:extension` | Build a `.vsix` into `dist/` |
| `npm run typecheck` | Typecheck every workspace |
| `npm run lint` | Lint every workspace |

## Contributing

Start with [CONTRIBUTING.md](./CONTRIBUTING.md). Good first areas: a real execution sandbox, deploy and GitHub export, and tests for the web app — it currently has none.

## Security

See [SECURITY.md](./SECURITY.md). In short: generated code is not sandboxed, and the extension's self-healing loop runs `npm install` and your test scripts. Review what it produces before running it on anything you care about.

## License

MIT — see [LICENSE](./LICENSE).
