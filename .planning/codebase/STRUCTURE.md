# Verno — Project Structure

## Root
```
Verno/
├── .agent/               # GSD system (skills, workflows, bin)
├── .planning/            # GSD planning artifacts
├── .vscode/              # Editor settings
├── docs/                 # Additional documentation
├── examples/             # Usage examples
├── media/                # Extension icons/assets
├── out/                  # Compiled JS output (gitignored)
├── src/                  # TypeScript source
├── tests/                # Test files
├── package.json          # Extension manifest + npm deps
├── tsconfig.json         # TypeScript config
├── playwright.config.ts  # E2E test config
└── eslint.config.mjs     # Linting config
```

## Source Tree
```
src/
├── agents/
│   ├── BMAD/             # 10 specialist agents
│   ├── base/             # BaseAgent abstract class
│   ├── core/             # Core agent interfaces
│   ├── planning/         # PlanningAgent
│   ├── specialized/      # Specialized variations
│   ├── DebateOrchestrator.ts
│   ├── FeedbackEnabledAgent.ts
│   ├── MultiAgentManager.ts
│   ├── OrchestratorEnhancedAgent.ts
│   └── index.ts          # AgentRegistry + OrchestratorAgent
├── commands/
│   ├── StartRecordingCommand.ts
│   ├── StopRecordingCommand.ts
│   └── ManageAgentsCommand.ts
├── config/
│   └── ConfigService.ts
├── jira/                 # Jira REST API client
├── panels/
│   └── SDLCWebviewPanel.ts
├── services/
│   ├── audioRouter.ts
│   ├── audioSanitizer.ts
│   ├── conversationEngine.ts
│   ├── ttsService.ts
│   ├── localWhisperService.ts
│   ├── conversation/     # ConversationService
│   ├── feedback/         # FeedbackService
│   ├── file/             # FileService + FileChangeTracker
│   ├── llm/              # LLMService, GeminiProvider, GroqProvider
│   ├── planning/         # Planning helpers
│   ├── progress/         # ProgressIndicator
│   ├── project/          # ProjectAnalyzer
│   ├── rag/              # VectorStore, EmbeddingService, ContextEngine
│   ├── todo/             # TodoService
│   ├── voice/            # Voice processing
│   └── workflow/         # ContextBuilder
├── types/
│   ├── agents.ts
│   ├── index.ts
│   └── sdlc.ts
├── ui/
│   ├── ActivityBarProgress.ts
│   ├── panels/           # AgentPanel, SidebarProvider, EnhancedSidebarProvider
│   ├── statusBar/        # RecordingStatus
│   ├── templates/        # Webview HTML templates
│   └── webviews/         # Webview component helpers
├── utils/
│   └── logger.ts
└── extension.ts          # Extension entry point
```

## Generated Artifacts (in user workspace)
```
workspace/.verno/
├── conversations/        # Conversation history JSON
├── todos/                # Agent-generated TODO lists
├── feedback/             # Agent feedback reports
├── PRD.md               # SDLC-generated Product Requirements Document
├── tasks.md             # Epics and Stories
├── sdlc-state.json      # SDLC session state
├── jira-config.json     # Jira project settings
├── PROJECT_PLAN.md      # Planning agent output
├── ANALYSIS.md          # Analyst agent output
├── ARCHITECTURE.md      # Architect agent output
└── QA_PLAN.md           # QA agent output
```
