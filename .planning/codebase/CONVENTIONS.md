# Verno — Code Conventions

## TypeScript
- Classes for all agents, services, and UI providers
- Interfaces defined in `src/types/` (agents.ts, index.ts, sdlc.ts)
- `async/await` throughout — no raw Promise chains
- `private` for all internal methods; `protected` for logger in base classes
- Explicit return types on public methods

## Naming
- PascalCase for classes: `DeveloperAgent`, `ConversationEngine`
- camelCase for methods and variables
- SCREAMING_SNAKE for module-level constants (rare)
- Agent names follow role: `AnalystAgent`, `ArchitectAgent`
- Service files: `*Service.ts` or descriptive noun: `ConversationEngine.ts`

## Error Handling
- All `async` entry points wrapped in try/catch
- Errors surfaced via `Logger.error()` + `vscode.window.showErrorMessage()`
- Non-fatal errors logged via `logger.warn()`
- Critical issues add to `FeedbackService` with severity tags

## Logging
- `Logger` class wraps `vscode.OutputChannel`
- Log levels: `info`, `warn`, `error`
- Prefix logs with agent/service name

## File Organization
```
src/
├── agents/        # All agent classes (BMAD, planning, orchestration)
├── commands/      # VSCode command handlers
├── config/        # ConfigService
├── jira/          # Jira integration
├── panels/        # Webview panel classes (SDLCWebviewPanel)
├── services/      # Business logic services
│   ├── llm/       # LLM provider abstraction
│   ├── rag/       # Vector store + embedding pipeline
│   ├── voice/     # Audio processing
│   └── ...
├── types/         # Shared TypeScript interfaces
├── ui/            # VSCode UI providers (panels, statusBar, templates)
└── utils/         # Logger, helpers
```

## Testing
- Unit tests in `tests/services/` using Mocha (via vscode-test)
- E2E tests in `tests/e2e/` using Playwright
- Test files: `*.test.ts`
- Mock VSCode API with `createFakeVSCodeModule()` pattern

## Webview HTML
- Generated via TypeScript template strings in `*Provider.ts` files
- CSP headers set in every webview
- `nonce` used for inline scripts
