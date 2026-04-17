# Contributing to Verno

Thank you for your interest in contributing to Verno! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** 18 or higher
- **VS Code** 1.80.0 or higher
- **Git** for version control

## Setup

```bash
# Clone the repository
git clone https://github.com/maybeanns/Verno.git
cd Verno

# Install dependencies
npm ci

# Compile TypeScript
npm run compile
```

## Development

### Running the Extension

1. Open the project in VS Code
2. Press **F5** to launch the Extension Development Host
3. The extension will activate in the new VS Code window

### Watch Mode

For automatic recompilation on file changes:

```bash
npm run watch
```

### Project Structure

```
src/
├── agents/           # All agent implementations
│   ├── BMAD/         # BMAD multi-agent pipeline agents
│   ├── base/         # BaseAgent, AgentRegistry
│   ├── core/         # OrchestratorAgent, RouterAgent, PlannerAgent
│   ├── planning/     # PlanningAgent
│   └── specialized/  # CodeGenerator, Debug, Refactor, etc.
├── commands/         # VS Code command handlers
├── config/           # ConfigService (SecretStorage wrapper)
├── panels/           # SDLC webview panel
├── services/         # All services
│   ├── llm/          # LLMService + providers (Gemini, Groq, Anthropic, OpenAI, Mock)
│   ├── file/         # FileService, FileChangeTracker
│   ├── rag/          # VectorStore, EmbeddingService, ContextEngine
│   ├── workspace/    # WorkspaceIntelligence
│   ├── conversation/ # ConversationService
│   ├── planning/     # PlanStateService
│   ├── project/      # ProjectAnalyzer, OTel, Grafana, OWASP services
│   ├── testing/      # CoverageParser
│   ├── documentation/# ReadmeSyncService, ChangelogGenerator
│   ├── todo/         # TodoService
│   └── feedback/     # FeedbackService
├── test/             # Test suites
│   └── suite/        # Mocha test files
├── types/            # TypeScript interfaces
├── ui/               # UI components
│   ├── panels/       # Sidebar providers, AgentPanel
│   ├── onboarding/   # WelcomePanel
│   ├── statusBar/    # RecordingStatus
│   └── templates/    # Webview HTML templates
├── utils/            # Logger, helpers
└── extension.ts      # Main activation entry point
```

## Testing

### Run All Tests

```bash
npm test
```

This uses `@vscode/test-electron` to run Mocha tests inside a VS Code extension host.

### Test Files

Tests live in `src/test/suite/`. Key test files:

| File | Tests |
|------|-------|
| `extension.test.ts` | Extension activation |
| `DeveloperAgent.test.ts` | Code generation with MockLLMProvider |
| `OrchestratorAgent.test.ts` | Multi-agent workflow routing |
| `ConversationEngine.test.ts` | History, context building, pipeline nudges |

### MockLLMProvider

For deterministic testing without API calls, use `MockLLMProvider`:

```typescript
import { MockLLMProvider } from '../../services/llm/providers/MockLLMProvider';

const mock = new MockLLMProvider();
mock.enqueueResponse('{"blocks": [...]}');

llmService.setProvider(mock);
```

## Linting

```bash
npm run lint
```

## Building

### Compile

```bash
npm run compile
```

### Package VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

## Pull Request Process

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes** with clear, descriptive commits
4. **Ensure CI passes**: `npm run compile && npm test`
5. **Submit a PR** against the `main` branch

### PR Requirements

- [ ] TypeScript compiles with zero errors
- [ ] All existing tests pass
- [ ] New features include test coverage
- [ ] No API keys or secrets in committed code

## Code Style

- **TypeScript strict mode** enabled
- **ESLint** configuration in project root
- Use **async/await** over raw Promises
- Document public APIs with JSDoc comments
- Follow existing patterns in the codebase

## Architecture

See the [README.md](./README.md) for the full Mermaid architecture diagram showing agent relationships, LLM provider flow, and cross-cutting services.

---

Questions? Open an issue or reach out via the repository discussions.
