# Verno — Architecture Map

## Overview
Verno is a TypeScript VSCode extension that implements a multi-agent AI coding assistant with voice interaction, SDLC orchestration, and Jira integration.

## Component Boundaries

### Entry Point
- `src/extension.ts` — Activates extension, wires all services, registers commands & webview providers

### Agent Layer (`src/agents/`)
- **BaseAgent** — Abstract base with logger, execute interface
- **OrchestratorAgent** — Routes plan/code execution; calls BMAD pipeline
- **PlanningAgent** — Generates project plans in planning mode
- **BMAD Pipeline** (parallel sub-agents):
  - AnalystAgent, ArchitectAgent, UXDesignerAgent
  - DeveloperAgent (code gen + quality checks)
  - QAEngineerAgent, TechWriterAgent, ProductManagerAgent
  - CodeReviewAgent — post-generation review
- **DebateOrchestrator** — 3-round AI debate for PRD generation
- **OrchestratorEnhancedAgent** — Enhanced version with feedback loop

### Service Layer (`src/services/`)
- **LLMService** — Provider abstraction (GeminiProvider, GroqProvider)
- **ConversationEngine** — Maintains rolling context window
- **ConversationService** — Persists conversations to `.verno/` dir
- **FileService / FileChangeTracker** — File I/O + diff tracking
- **TTSService** — Local Kokoro TTS with streaming
- **LocalWhisperService** — Local Whisper ASR (tiny→large-v3)
- **AudioRouter** — Smart route: local vs cloud ASR
- **AudioSanitizer** — Corrects misheard identifiers using symbols
- **FeedbackService** — Severity-tagged issue tracking
- **TodoService** — Task management with priority/dependency
- **ProgressIndicator** — VSCode activity bar progress
- **RAG pipeline** — VectorStore + EmbeddingService + ContextEngine (tiered retrieval)

### UI Layer (`src/ui/`)
- **AgentPanel** — Main chat webview panel
- **SidebarProvider** — Primary sidebar (agent panel host)
- **EnhancedSidebarProvider** — Dashboard with TODOs/Feedback/Conversations tabs
- **SDLCWebviewPanel** — SDLC wizard (debate → PRD → Jira)
- **RecordingStatus** — Status bar recording indicator

### Integration Layer
- **Jira** (`src/jira/`) — Atlassian REST API, auth, epic/story decomposition

## Data Flow

```
User Input (text/voice)
       ↓
AudioRouter → LocalWhisper / GroqCloud STT
       ↓
AudioSanitizer (symbol correction)
       ↓
ConversationEngine.think() ← workspace context
       ↓
processUserInput() → mode routing (ask/plan/code)
       ↓
OrchestratorAgent
  ├── plan mode → BMAD pipeline → DeveloperAgent (code gen + quality)
  ├── code mode → executeCode()
  └── sdlc trigger → DebateOrchestrator → PRD → Jira sync
       ↓
AgentPanel.addMessage() → TTS.speak()
       ↓
ConversationService (persistence)
```

## Build System
- TypeScript → `out/` via `tsc -p ./`
- VSCode extension host runtime
- Node.js 18+ required
- Tests: `vscode-test` (unit) + Playwright (e2e)
