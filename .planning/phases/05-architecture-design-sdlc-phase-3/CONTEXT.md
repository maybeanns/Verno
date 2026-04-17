# Phase 5: Architecture & Design (SDLC Phase 3) — Context

## Objective
Extend `ArchitectAgent` to produce ADRs, Mermaid diagrams (sequence, component, ER), and OpenAPI 3.1 contracts. Addressing ARC-01, ARC-02, and ARC-03 requirements.

## Current State
The `ArchitectAgent` exists but currently only outputs generic texts in the PRD or during the debate. It doesn't formalize decisions into structured ADRs, doesn't systematically generate diagrams, and lacks OpenAPI contract generation capabilities.

## Technical Decisions
1. **ADR Generation (ARC-01):**
   - The ArchitectAgent will identify key architectural design decisions during Phase 3 of the SDLC.
   - It will formalize them into MADR (Markdown Architecture Decision Records) formatted files.
   - Files will be saved to a `docs/architecture/decisions/` directory within the target user's workspace.
   - An `ARCHITECTURE.md` index or summary will be maintained.

2. **Mermaid Diagrams (ARC-02):**
   - The Architect Agent will construct appropriate sequence, component, and ER diagrams based on the system design.
   - These diagrams will be embedded using standard ` ```mermaid ` code blocks inside the relevant markdown documents (e.g., `ARCHITECTURE.md`), allowing native rendering in VSCode’s built-in Markdown preview.

3. **OpenAPI Contracts (ARC-03):**
   - If the PRD or design discussion indicates RESTful or HTTP APIs, the ArchitectAgent will generate an OpenAPI 3.1 specification.
   - The specification will be output as a valid YAML file (e.g., `openapi.yaml` in a designated `docs/` or `api/` directory) to enable seamless API-first development.

## Out of Scope
* Automatic validation/compilation of Mermaid syntax using external node modules (the system will rely on LLM correctness via prompting).
* Code scaffolding based on the OpenAPI spec (the generation of actual API routes is deferred to the code generation phase; this phase only produces the contract).

## Known Variables
* `ArchitectAgent.ts` is the primary file to modify.
* The SDLC state machine (`OrchestratorAgent.ts` or `PipelineManager.ts`) might need updates to invoke these specific generation tasks during the Architecture phase.

## Phase Strategy
* Plan 1: Implement ADR generation (`ARC-01`).
* Plan 2: Implement Mermaid syntax generation (`ARC-02`).
* Plan 3: Implement OpenAPI 3.1 contract generation (`ARC-03`).
