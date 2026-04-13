# Verno — Technology Stack

## Runtime
- **Node.js 18+** — Extension host runtime
- **TypeScript 5.x** — Primary language
- **VSCode API 1.80+** — Extension surface (commands, webviews, sidebar)

## AI / LLM
- **Gemini** (default) — via `@google/generative-ai` (inferred from GeminiProvider)
- **Groq** — `groq-sdk ^0.37.0` — LLaMA fallback / cloud STT
- **@xenova/transformers ^2.17.2** — Local ONNX inference for Whisper + embeddings
- **onnxruntime-web ^1.24.3** — ONNX execution engine

## Voice
- **@ricky0123/vad-web ^0.0.30** — Voice Activity Detection in browser/webview
- **web-tree-sitter ^0.26.6** — Symbol parsing for audio sanitization
- **tree-sitter-wasms ^0.1.13** — Language grammars for tree-sitter

## Data / Storage
- **Local filesystem** — `.verno/` workspace dir for conversations, todos, feedback
- **In-memory VectorStore** — custom cosine-similarity vector DB in `src/services/rag/`

## Testing
- **@vscode/test-cli ^0.0.12** — VSCode extension unit test runner
- **@vscode/test-electron ^2.5.2** — Electron-based test runner
- **@playwright/test ^1.58.2** — E2E browser automation

## Build
- **tsc** — TypeScript compiler
- **eslint ^9.39.2 + typescript-eslint ^8.54.0** — Linting

## Integrations
- **Atlassian Jira REST API v3** — Epic/Story/Subtask creation
- **form-data ^4.0.5** — Multipart form uploads (audio)

## Key Architecture Decisions
| Decision | Rationale |
|----------|-----------|
| Local Whisper first | Privacy, no round-trip latency for short commands |
| In-memory VectorStore | No external DB dependency; sufficient for single workspace |
| Provider abstraction (LLMService) | Swap Gemini/Groq without re-wiring call sites |
| Webview-based UI | Rich chat UI impossible with native VSCode tree views |
| `.verno/` workspace dir | Portable, git-trackable conversation history |
