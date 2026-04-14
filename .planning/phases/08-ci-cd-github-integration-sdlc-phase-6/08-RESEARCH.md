# Phase 08 Research: CI/CD & GitHub Integration

## Domain & Dependency Analysis

1.  **Workspace Stack Detection**
    -   Verno currently relies on `src/services/workspace/WorkspaceIntelligence.ts` to detect the user's tech stack (e.g., Next.js, Express, Rails, Python).
    -   *Dependency*: The CI/CD actions and Dockerfile/docker-compose scaffolds will leverage this exact `detectedFramework` / `stackSummary` string to select the correct template layout for generated YAML/Dockerfiles.

2.  **Git / Repository Detection (CIC-04)**
    -   Currently, there are no existing `GitService` files. The new feature requires checking if the root directory is a git repository (`git remote -v`), identifying branches, and determining if the workspace is attached to GitHub.
    -   *Implementation Strategy*: We will either use simple `child_process.exec('git remote -v')` or create a new `src/services/project/GitService.ts` to handle repository interactions.
    -   The user decided in `08-CONTEXT.md` that Verno will execute a "Direct Commit & Push" workflow to the exact working branch without forcing multiple intermediary PRs (D-05/06).

3.  **CI/CD Scaffold (CIC-01) & Docker / K8s Manifests (CIC-02, CIC-03)**
    -   Verno will create these dynamically for the user Workspace. Target folders for the scaffold will be `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, and `helm/*` (as decided in CONTEXT.md for D-03/04: Full Helm Strategy).
    -   File generation can be handled via the existing `FileService.ts` running at the workspace root context. 

## Key Learnings & Verification Path

-   We must implement fully fleshed-out Dockerfile/Helm templates (not just stubs) because `08-CONTEXT.md` mandates a "Production Ready / Full CI/CD" schema.
-   Direct generation of these files into the user's project provides instant infrastructure out of the box.
-   For testing, we should scaffold mock templates that depend on the existing `WorkspaceIntelligence` detection outputs.
