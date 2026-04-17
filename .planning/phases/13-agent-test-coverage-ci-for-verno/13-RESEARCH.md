# Phase 13: Agent Test Coverage & CI for Verno - Research

## Goal
Establish injectable `MockLLMService`, write agent/service unit tests, and add GitHub Actions CI for the Verno extension itself.

## 1. Unit Testing Strategy for Agents
The VS Code extension uses `mocha` out of the box for testing (`src/test/suite`). 
- **MockLLMService**: To test agents deterministically, we need a `MockLLMService` that implements `ILLMProvider` or `LLMService` which returns predefined responses instead of hitting live APIs. It should be constructed such that we can easily enqueue responses `mockService.enqueueResponse('test plan')`.
- **DeveloperAgent Test**: Test that it parses instructions and modifies code correctly given a simulated completion.
- **OrchestratorAgent Test**: Verify it routes requests properly based on LLM intentions (ask vs plan vs code).
- **ConversationEngine Test**: Ensure context building strips tokens properly, formats the system prompts correctly, and maintains temporal history.

## 2. CI/CD for VS Code Extension
GitHub Actions workflow should run on `push` and `pull_request` to `main`.
Steps for a VS Code CI:
- Checkout
- Setup Node.js (v18+)
- Install dependencies (`npm ci` or `npm install`)
- Lint source code (`npm run lint` if configured)
- Type check / compile (`npm run compile`)
- Run vsce tests (`npm run test`) on an Xvfb display if it requires a UI window, or just raw unit tests if decoupled from the VS Code windowing.

### Architecture impact
Dependencies needed for tests might include `@types/mocha` and `sinon` for spies/mocks. `vscode` mock might be needed if tests run outside the extension host, but standard `npm run test` uses `@vscode/test-electron` to run tests inside a true extension host environment.

## 3. Validation Architecture
**Dimension 8:**
- CI runs `npm test` successfully.
- Actions pass on the push event.
- MockLLMService intercepts and prevents live API calls in test cases.

## Decision / Strategy
- **MockLLMService.ts**: Placed in `src/test/suite/mocks/MockLLMService.ts` or in `src/services/llm/providers/` if we want to use it optionally via DI. We will place it in `src/services/llm/providers/MockLLMService.ts` as the requirements state "injectable".
- **Agent Tests**: Created inside `src/test/suite/`.
- **Github Actions**: Written to `.github/workflows/ci.yml`.
