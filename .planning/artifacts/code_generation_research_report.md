# 🏛️ Verno Council of Agents: Code Generation & Preview Research Report

**Date:** April 30, 2026
**Prepared By:** The Verno Multi-Agent Council (Architect, Developer, DevOps, QA)
**Subject:** Code Generation Quality, Testing Strategies, Preview Engine Diagnostics, and Industry Standards.

---

## 1. Diagnostics: Why the Software Preview is Failing

*Report by DevOps Agent & Architect Agent*

The persistent `"e is not a constructor"` and related runtime errors in the `Workspace Preview Engine` (specifically `SandboxPreview.tsx`) stem from fundamental architectural flaws in how we currently render React code in the browser. 

### The Current Flawed Implementation
Currently, Verno's `SandboxPreview.tsx` attempts to render generated React applications by:
1. Concatenating all generated React component files into a single giant string.
2. Using a custom Babel AST plugin (`removeImportsExportsPlugin`) to aggressively strip all `import` and `export` statements.
3. Injecting global stubs for libraries like `lucide-react`, `framer-motion`, `recharts`, and UI components into the `window` object.
4. Transpiling the giant string on-the-fly inside an `iframe` using a CDN version of `@babel/standalone`.
5. Executing it using `(0, eval)`.

### Root Causes of Failure
*   **Fragile AST Manipulation:** Stripping `import`/`export` declarations breaks real-world module patterns. If an agent generates an `export * from './something'` or uses complex destructuring, our naive Babel plugin fails, leading to malformed transpiled code.
*   **Missing Dependency Resolution:** Real apps rely on a module bundler (like Webpack or Vite) to resolve paths and handle node modules. By evaluating everything in a global scope, we cause naming collisions and "undefined is not a function" errors.
*   **"e is not a constructor":** This specific error is a classic artifact of minified code or a transpilation failure where a required class or function reference (like a React hook or a library component) was stripped out or overridden by our global stubs.

---

## 2. Industry Standards: How the Giants Do It

*Report by Research Agent*

To understand how to fix this, we analyzed platforms like **Bolt.new**, **Lovable**, **emergent.sh**, and **Codex**. They achieve production-grade in-browser code generation by abandoning the naive `iframe + eval` approach.

### StackBlitz WebContainers (Used by Bolt.new)
*   **The Technology:** WebContainers are WebAssembly-based operating systems that run directly inside the browser tab. 
*   **How it Works:** They provide a real Node.js environment in the browser. When the AI generates code, it writes to a virtual filesystem. Bolt.new runs a real `npm install` and starts a real `Vite` dev server inside the browser.
*   **The Advantage:** The AI writes standard, unmodified code. There is no need for AST hacks. The preview is a true representation of the code.

### Sandpack by CodeSandbox (Used by Lovable & v0)
*   **The Technology:** Sandpack provides an isolated, browser-based bundler environment.
*   **How it Works:** It takes raw files (React, Next.js, Vite) and bundles them in the browser in real-time, handling npm dependencies automatically.
*   **The Advantage:** Lovable doesn't need to strip imports. It passes the generated files to Sandpack, which dynamically fetches dependencies from a CDN and renders the app perfectly.

### Multi-Agent Autonomous Orchestration (Emergent.sh)
*   **The Technology:** Beyond just executing code, emergent.sh uses a multi-agent "Vibe Coding" workflow.
*   **How it Works:** It uses a Planning Agent, Frontend Agent, Backend Agent, and PM Agent. They write full-stack code (FastAPI + React) and deploy it to containerized cloud infrastructure, completely avoiding browser-only limitations.

---

## 3. Improving Code Generation Quality

*Report by Developer Agent & Architect Agent*

To reach the standards of Bolt.new and Lovable, Verno must upgrade its code generation pipeline:

1.  **Stop Global Stubs & Embrace Modules:** AI models are trained on real GitHub codebases containing proper `import`/`export` statements. Forcing the AI to write "single-file-friendly" code severely degrades its performance and reasoning. Let the AI write standard ES Modules.
2.  **Multi-Agent Context Passing:** Implement a strict pipeline where the Architect Agent creates a `SYSTEM_DESIGN.md`, the Backend Agent writes schemas, and the Frontend Agent consumes those schemas to build the UI. 
3.  **Self-Healing Feedback Loops:** If a WebContainer or Sandpack environment throws a compiler error, the output should NOT be shown to the user immediately. Instead, the error must be fed back to the Developer Agent to autonomously fix the syntax before presenting the preview.

---

## 4. Upgrading the Testing Strategy

*Report by QA Agent*

Code generation is non-deterministic. A robust testing layer is mandatory.

### Proposed Testing Architecture for Verno
1.  **Static Analysis (Pre-Preview):**
    *   Integrate `TypeScript` compiler API or `ESLint` to validate the generated code's AST *before* sending it to the preview engine. If syntax errors exist, trigger the self-healing loop.
2.  **Component Testing:**
    *   Leverage AI-driven test generation. Whenever the Developer Agent creates a component, the QA Agent must generate a corresponding Playwright/Jest test.
3.  **Visual Regression Validation:**
    *   Use an agent equipped with vision capabilities (e.g., GPT-4o Vision) to compare the rendered output of the WebContainer against the user's initial UI requirements.
4.  **Security Audits:**
    *   The Security Agent must scan generated backend endpoints and API routes for OWASP top 10 vulnerabilities (e.g., ensuring SQL injection protections in database code).

---

## 5. Actionable Recommendations for Verno

The Council unanimously recommends the following strategic pivots for the Verno SDLC pipeline:

### Immediate Fix (Phase 1)
*   **Rip out `SandboxPreview.tsx` custom Babel logic.**
*   **Implement Sandpack (`@codesandbox/sandpack-react`).** By passing the `GeneratedFile[]` array directly to Sandpack, it will handle npm dependencies (like `lucide-react`, `framer-motion`) and bundling natively in the browser. This will instantly solve the "e is not a constructor" and broken import issues.

### Mid-Term Goal (Phase 2)
*   **Integrate StackBlitz WebContainers.** This will allow Verno to move beyond simple React components and generate full-stack applications (Next.js, Vite + Node.js backend) running entirely in the user's VS Code extension webview.

### Long-Term Vision (Phase 3)
*   **Implement the Emergent.sh Model.** Shift from generating just frontend previews to generating Dockerized full-stack infrastructure. The Verno CI/CD phase should automatically deploy the generated codebase to a staging environment (e.g., Vercel, Railway, AWS) rather than relying solely on local previews.
