# Verno — External Integrations

## VSCode Extension API
- **Version:** ^1.80.0
- **Surface used:** Commands, WebviewView providers, OutputChannel, StatusBar, SecretStorage (planned), workspace.workspaceFolders
- **Webview Communication:** `postMessage` bidirectional with typed message contracts

## Google Gemini API
- **SDK:** via HTTP calls in `GeminiProvider` (inferred)
- **Key Storage:** Currently runtime input box — should migrate to VSCode SecretStorage
- **Models used:** Gemini Flash / Pro (model selection via webview)
- **Streaming:** Yes — `streamGenerate()` with token callbacks

## Groq API
- **SDK:** `groq-sdk ^0.37.0`
- **Usage:** LLaMA inference fallback + Whisper cloud STT
- **Key Storage:** Same issue as Gemini — runtime entry box

## Atlassian Jira REST API v3
- **Auth:** Basic auth (email + API token)
- **Endpoints:** Create issue (Epic/Story/Subtask), list projects
- **Config:** Stored in `.verno/jira-config.json` in user workspace
- **State recovery:** `sdlc-state.json` persists across webview restarts

## Local Models (via @xenova/transformers)
- **Whisper** — tiny/base/small/medium/large-v3 (user configurable)
- **Embeddings** — Sentence transformers for RAG vector matching
- **Runtime:** ONNX via `onnxruntime-web`
- **Download:** First-use model download with progress (extensionPath cache)

## voice-activity-detection
- **Library:** `@ricky0123/vad-web ^0.0.30`
- **Runtime:** Runs in webview (browser context)
- **Purpose:** Detect speech start/end without explicit push-to-talk

## Tree-sitter
- **Libraries:** `web-tree-sitter ^0.26.6`, `tree-sitter-wasms ^0.1.13`
- **Usage:** Parse active file symbols for audio sanitization (correct misheard identifiers)
- **Languages:** Multiple grammar WASMs bundled
