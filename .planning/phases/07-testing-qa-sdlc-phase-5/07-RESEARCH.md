# Phase 07 Research: Testing & QA

## Current Infrastructure Analysis

1.  **MockLLMService (`src/services/llm/MockLLMService.ts`)**
    -   *Current*: Simple array-based sequential response.
    -   *Required*: Record/Replay system. Needs to hash prompts and store/retrieve responses from a local JSON/YAML file (e.g., in `.verno/mocks/`). This ensures deterministic testing for Verno's own agents.

2.  **TestGeneratorAgent (`src/agents/specialized/TestGeneratorAgent.ts`)**
    -   *Current*: Static prompts for Jest and integration tests. Hardcoded file paths (`generated/index.test.ts`).
    -   *Required*: Logic-aware and context-driven. Needs to:
        -   Generate tests in the same directory as the source file (or `__tests__` neighbor).
        -   Analyze function signatures and bodies for logic-aware assertions (D-04).
        -   Scaffold Playwright E2E tests by parsing `REQUIREMENTS.md` or PRD user flows.

3.  **Coverage Visibility**
    -   Verno already has a `ProgressIndicator` and `FeedbackService`.
    -   *Missing*: A dedicated sidebar tree view or status bar item for "Test Coverage".
    -   *Integration*: Needs to parse `coverage-summary.json` (from Jest) and reflect it in the UI.

4.  **Targets for Self-Testing**
    -   `OrchestratorAgent.ts` (Core logic)
    -   `ConversationEngine.ts` (Prompt building)
    -   `DeveloperAgent.ts` (Code healing)
    -   Goal: >= 80% coverage using the upgraded `MockLLMService`.

## Implementation Strategy

-   **Wave 1**: Upgrade `MockLLMService` and implement critical agent unit tests.
-   **Wave 2**: Upgrade `TestGeneratorAgent` for logic-aware unit tests and Playwright scaffolding.
-   **Wave 3**: Implement Coverage Sidebar and integrate the full QA loop.
