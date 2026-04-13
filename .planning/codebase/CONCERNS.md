# Verno — Code Concerns & Risks

## Critical Issues

### 1. API Keys Prompted at Runtime — No Secure Storage
**Risk:** HIGH  
API keys are entered via `vscode.window.showInputBox` and stored in memory. They are never persisted via `vscode.SecretStorage`. On every new session, users must re-enter keys. A security boundary violation risk exists if keys leak to logs.
- **Files:** `src/extension.ts:375-385`, `src/services/llm/`
- **Fix:** Use `context.secrets.store()` / `context.secrets.get()` for all API keys

### 2. No AnthropicSDK / OpenAI Support Despite README Claims
**Risk:** HIGH  
README lists Anthropic and OpenAI as supported providers; codebase only has `GeminiProvider` and `GroqProvider`. Settings expose `verno.anthropicApiKey` and `verno.openaiApiKey` as config keys but no provider implements them.
- **Files:** `src/services/llm/`, `package.json:87-91`

### 3. In-Memory VectorStore — No Persistence
**Risk:** MEDIUM  
`VectorStore` holds embeddings only in RAM. Every extension restart forces a full re-index. For large workspaces this causes latency spikes.
- **Files:** `src/services/rag/VectorStore.ts`

### 4. `DeveloperAgent.runQualityChecks` Runs `npm install` on user's workspace
**Risk:** MEDIUM  
Silently runs `npm install` in the user's project after code generation. This can corrupt `node_modules` or cause unexpected side effects.
- **Files:** `src/agents/BMAD/DeveloperAgent.ts:207-221`

### 5. Race Condition — Extension-Wide Singletons
**Risk:** MEDIUM  
`logger`, `llmService`, `agentPanel` etc. are module-level `let` variables. Multiple activation calls (possible in test environments) can leave stale instances.
- **Files:** `src/extension.ts:28-41`

### 6. Missing Error Boundary on Webview Message Handlers
**Risk:** LOW-MEDIUM  
The `AgentPanel` and `EnhancedSidebarProvider` webviews receive messages from untrusted HTML. No input sanitization or message-type validation guard.

## Technical Debt

- `version: "0.0.1"` in `package.json` — not bumped despite 0.2.0 changelog
- `publisher: "yourname"` — placeholder never updated
- `logger.show()` called on every activation — floods Output panel by default
- `IMPLEMENTATION.md` written to user workspace root on every code gen — noisy
- Multiple TODO/FIXME comments left in `DeveloperAgent.ts` and `ConversationEngine.ts`
- E2E Playwright tests have zero assertions (`tests/e2e/example.spec.ts` is skeleton)
- No CI/CD pipeline defined (no `.github/workflows/`)
