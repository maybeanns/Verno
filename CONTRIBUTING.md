# Contributing to Verno

## Setup

Node.js 18 or newer.

```bash
git clone https://github.com/maybeanns/Verno.git
cd Verno
npm ci
npm run build:packages
```

`npm run build:packages` compiles `packages/agents` and `packages/llm`. Both apps import them, so a clean checkout will not typecheck until it has run.

## Layout

```
apps/web/          Next.js app
apps/extension/    VS Code extension
packages/agents/   Agent personas and debate contracts
packages/llm/      Provider registry and model catalog
```

If a change affects how agents behave in both surfaces, it belongs in `packages/`, not in one of the apps. The persona definitions were duplicated across both for a long time and drifted apart — please don't reintroduce that.

## Working on the web app

```bash
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

Never put a real key in `.env.example`. If you need to show the shape of a value, use an empty assignment or an obvious placeholder.

## Working on the extension

```bash
npm run compile -w verno     # or: npm run watch -w verno
```

Open `apps/extension` in VS Code and press `F5`.

Two features are excluded from the packaged `.vsix` because they add roughly 180 MB: embeddings (`@huggingface/transformers`) and Mermaid rendering (`@mermaid-js/mermaid-cli`). Both are dynamically imported and degrade to "unavailable" when missing. They work normally when you run from source.

## Before opening a PR

```bash
npm run typecheck
npm run lint
npm test -w verno
npm run build:web       # if you touched apps/web
```

`npm test -w verno` launches a real VS Code instance. On Linux it needs `xvfb-run -a` in front of it.

## Conventions

- 4-space indent, single quotes, semicolons. `.editorconfig` and `.prettierrc.json` carry the details.
- Comments should explain why something is the way it is, not restate the code.
- Keep a PR to one concern. A refactor bundled into a bug fix is hard to review and harder to revert.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). The extension's changelog generator parses them.

## Reporting bugs

Use the issue templates. For anything security-related, follow [SECURITY.md](./SECURITY.md) and report privately instead.

## Code of conduct

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) applies to every interaction in this repository.
