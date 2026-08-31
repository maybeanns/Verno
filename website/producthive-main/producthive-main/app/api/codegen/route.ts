/**
 * POST /api/codegen — BMAD-powered code generation SSE stream.
 *
 * Uses selective context feeding: only sends relevant file snippets
 * to the AI, keeping its "memory" clean and focused.
 *
 * Enforced Stack: React, TypeScript, Tailwind CSS, Vite, shadcn/ui, Supabase
 *
 * Agents used:
 *  - architect   → scaffolds project structure, decides component tree
 *  - developer   → writes actual code
 *  - ux          → shadcn/ui component selection, layout decisions
 *  - security    → auth patterns, env handling
 */

import { NextRequest } from 'next/server';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeneratedFile {
    path: string;
    content: string;
    language: string;
}

// ─── LLM Call (reuse logic from debate route) ───────────────────────────────

async function callLLM(
    prompt: string,
    provider: string,
    apiKey: string,
    modelId?: string,
    maxTokens: number = 2000
): Promise<string> {
    if (provider === 'Anthropic' || provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Anthropic API error (${res.status}): ${errBody}`);
        }
        const data = await res.json();
        return data.content?.[0]?.text?.trim() ?? '';
    }

    let url = '';
    let model = '';

    switch (provider) {
        case 'test':
            url = 'https://api.groq.com/openai/v1/chat/completions';
            apiKey = process.env.GROQ_API_KEY || apiKey;
            model = modelId !== 'test' && modelId ? modelId : 'llama-3.3-70b-versatile';
            break;
        case 'Groq':
        case 'groq':
        case 'Meta':
            url = 'https://api.groq.com/openai/v1/chat/completions';
            model = modelId || 'llama-3.3-70b-versatile';
            break;
        case 'OpenAI':
        case 'openai':
            url = 'https://api.openai.com/v1/chat/completions';
            model = modelId || 'gpt-4o';
            break;
        case 'Qwen':
            url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            model = modelId || 'qwen-max';
            break;
        case 'Mistral AI':
            url = 'https://api.mistral.ai/v1/chat/completions';
            model = modelId || 'mistral-large-latest';
            break;
        case 'Google':
        case 'google':
            url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            model = modelId || 'gemini-2.5-flash';
            break;
        case 'Moonshot AI':
            url = 'https://api.moonshot.cn/v1/chat/completions';
            model = modelId || 'moonshot-v1-32k';
            break;
        case 'MiniMax':
            url = 'https://api.minimax.chat/v1/chat/completions';
            model = modelId || 'minimax-text-01';
            break;
        case 'DeepSeek':
            url = 'https://api.deepseek.com/chat/completions';
            model = modelId || 'deepseek-chat';
            break;
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }

    const makeRequest = async (currentModel: string) => {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: 0.4,
            }),
        });
    };

    let res = await makeRequest(model);

    // Fallback for rate limits
    if (!res.ok && res.status === 429 && (provider.toLowerCase() === 'groq' || provider === 'test')) {
        const fallbacks = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];
        for (const fb of fallbacks) {
            if (fb === model) continue;
            res = await makeRequest(fb);
            if (res.ok || res.status !== 429) break;
        }
    }

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${provider} API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── Prompt Builders ────────────────────────────────────────────────────────

function buildArchitectPrompt(topic: string, projectType: string): string {
    return `You are a senior System Architect. A user wants to build: "${topic}" (type: ${projectType}).

ENFORCED STACK (non-negotiable):
- React 18+ with TypeScript
- Tailwind CSS for styling
- Vite as build tool
- shadcn/ui for UI components (uses Radix UI primitives + Tailwind)
- Supabase for backend (auth, database, storage)

Your task: Design the file structure and component tree.

Respond ONLY with a valid JSON object:
{
  "projectName": "kebab-case-name",
  "description": "One sentence",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "framer-motion": "^11.0.0"
  },
  "files": [
    { "path": "src/App.tsx", "purpose": "Main app with routing", "priority": 1 },
    { "path": "src/components/ui/button.tsx", "purpose": "shadcn Button", "priority": 2 }
  ],
  "componentTree": "App > Layout > [Page1, Page2] > Components",
  "supabaseTables": [
    { "name": "users", "columns": ["id uuid PK", "email text", "created_at timestamptz"] }
  ]
}

RULES:
- Keep it minimal. MVP only — 8-15 files max.
- MANDATORY FILES (always include all of these): index.html, package.json, vite.config.ts, tailwind.config.ts, postcss.config.js, tsconfig.json, src/main.tsx, src/App.tsx, src/index.css, src/lib/utils.ts
- Include src/lib/supabase.ts for the Supabase client.
- DO NOT create barrel files (index.ts that re-exports). Each component must be imported from its own file.
- The "dependencies" field must list ALL npm packages needed by the generated code.
- Use shadcn/ui style components: Button, Card, Input, Dialog, etc.
- No placeholder or TODO files — every file must have a clear purpose.`;
}

function extractFileSkeleton(file: GeneratedFile): string {
    const lines = file.content.split('\n');
    const skeletonLines: string[] = [];

    const exportRegex = /^(export\s+(const|function|interface|type|class|enum)\s+([a-zA-Z0-9_]+))/;
    let insideInterfaceOrType = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (insideInterfaceOrType) {
            skeletonLines.push(lines[i]);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            if (braceCount <= 0) {
                insideInterfaceOrType = false;
            }
            continue;
        }

        const match = line.match(exportRegex);
        if (match) {
            const type = match[2];

            if (type === 'interface' || type === 'type' || type === 'enum') {
                skeletonLines.push(lines[i]);
                if (line.includes('{')) {
                    insideInterfaceOrType = true;
                    braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                }
            } else if (type === 'function') {
                skeletonLines.push(lines[i]);
            } else if (type === 'const') {
                if (line.includes('=>') || line.includes('function')) {
                    skeletonLines.push(lines[i]);
                } else {
                    const parts = lines[i].split('=');
                    skeletonLines.push(parts[0] + ';');
                }
            } else if (type === 'class') {
                skeletonLines.push(lines[i]);
            }
        }
    }

    return skeletonLines.join('\n');
}

function buildProjectSkeleton(files: GeneratedFile[]): string {
    const skeletons: string[] = [];
    for (const file of files) {
        if (file.path === 'package.json' || file.path.includes('config') || file.path.endsWith('.css') || file.path.endsWith('.html')) {
            continue;
        }
        const skel = extractFileSkeleton(file);
        if (skel.trim()) {
            skeletons.push(`--- FILE: ${file.path} (Exports) ---\n${skel}\n`);
        } else {
            skeletons.push(`--- FILE: ${file.path} (Exists) ---\n`);
        }
    }
    return skeletons.join('\n');
}

function buildCodegenPrompt(
    topic: string,
    filePath: string,
    filePurpose: string,
    projectStructure: string,
    existingFiles: GeneratedFile[]
): string {
    const relevantFiles = selectRelevantContext(filePath, existingFiles).slice(0, 2);
    const contextBlock = relevantFiles.length > 0
        ? `\nRELEVANT FILE CONTENTS (full context for imported files):\n${relevantFiles.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}`
        : '';

    const skeletonFiles = existingFiles.filter(f => !relevantFiles.some(r => r.path === f.path));
    const skeletonBlock = skeletonFiles.length > 0
        ? `\nPROJECT SKELETON (other files and their exported signatures/props):\n${buildProjectSkeleton(skeletonFiles)}`
        : '';

    return `You are an expert React/TypeScript developer. Generate the COMPLETE file content for:

FILE: ${filePath}
PURPOSE: ${filePurpose}
PROJECT: "${topic}"

FULL PROJECT STRUCTURE:
${projectStructure}
${contextBlock}

ENFORCED STACK:
- React 18+ with TypeScript (strict mode)
- Tailwind CSS (utility-first, no custom CSS files except src/index.css for Tailwind directives)
- shadcn/ui components (import from "@/components/ui/...")
- Supabase client from "@/lib/supabase"
- Vite (import.meta.env for env vars)

CRITICAL RULES — VIOLATIONS WILL BREAK THE BUILD:
- Output ONLY the raw file content. No markdown fences, no explanations, no comments like "// rest of code here".
- Use proper TypeScript types — no \`any\`.
- EXPORT RULE: Every React component MUST have BOTH a named export AND a default export (e.g. \`export const Button = ...; export default Button;\`).
- IMPORT RULE: Import components from their own file path. Do NOT use barrel imports (e.g., do NOT import from an index.ts).
- DO NOT use \`export * from\` or \`export { X } from\` re-export patterns. They break the bundler.
- Every file must be COMPLETE and SELF-CONTAINED. Never write partial code or truncate.
- Import cn from "@/lib/utils" for className merging.
- For Supabase: use createClient from @supabase/supabase-js with fallback env values (e.g., \`import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'\`). DO NOT throw errors for missing env vars.
- If generating src/index.css: MUST include \`@tailwind base; @tailwind components; @tailwind utilities;\`.
- If generating package.json: include all dependencies as a valid JSON object.
- If generating index.html: output a valid Vite index.html with \`<script type="module" src="/src/main.tsx"></script>\`.
- If generating postcss.config.js: use \`export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\`.
- Make it production-quality with real placeholder data, polished UI, proper spacing, hover states, and dark mode support.`;
}

function selectRelevantContext(targetPath: string, existingFiles: GeneratedFile[]): GeneratedFile[] {
    if (existingFiles.length === 0) return [];

    const targetDir = targetPath.split('/').slice(0, -1).join('/');
    const targetName = targetPath.split('/').pop() || '';

    // Score files by relevance
    const scored = existingFiles.map(f => {
        let score = 0;
        const fDir = f.path.split('/').slice(0, -1).join('/');

        // Same directory = high relevance
        if (fDir === targetDir) score += 3;

        // Config files always relevant
        if (f.path.includes('config') || f.path === 'package.json') score += 2;

        // Utility/lib files relevant to components
        if (targetPath.includes('components') && f.path.includes('lib/')) score += 2;

        // App.tsx relevant to pages
        if (targetPath.includes('pages') && f.path.includes('App.tsx')) score += 2;

        // Types/interfaces always relevant
        if (f.path.includes('types')) score += 1;

        return { file: f, score };
    });

    // Return top 4 most relevant files
    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(s => s.file);
}

function buildEditPrompt(
    topic: string,
    instruction: string,
    existingFiles: GeneratedFile[],
    projectStructure: string
): string {
    const fileContentsBlock = existingFiles
        .map(f => `=== FILE: ${f.path} ===\n${f.content}\n`)
        .join('\n');

    return `You are an expert React/TypeScript developer. You are asked to edit an existing project.
Original Project Goal: "${topic}"
User Edit Instruction: "${instruction}"

CURRENT FILES:
${fileContentsBlock}

ENFORCED STACK:
- React 18+ with TypeScript
- Tailwind CSS
- shadcn/ui components (import from "@/components/ui/...")
- Supabase client from "@/lib/supabase"
- Vite

Your task is to identify which files need to be modified or created, and return the changes as a JSON array of patch objects.
You can either edit existing files or create new ones.

Respond ONLY with a valid JSON array of patch objects. Do not include markdown code fences, do not include any commentary.
The structure of each patch object in the array must be:
{
  "file": "path/to/file",
  "action": "modify" | "create",
  "search": "exact code block to find",
  "replace": "new code block to replace it with"
}

If "action" is "create":
- "search" must be empty "".
- "replace" must contain the complete content of the new file.

If "action" is "modify":
- "search" MUST match a unique, exact, contiguous block of code in the existing file, including all whitespace, indentation, and newlines.
- "replace" must contain the new code block to replace the search block.
- Keep the search block as small as possible to avoid errors, but large enough to be uniquely matching.
- Do NOT output placeholder code in "replace". It must be complete, working code.

Ensure the output is strictly valid JSON.`;
}

function applyPatch(
    filePath: string,
    fileContent: string,
    search: string,
    replace: string,
    action: 'modify' | 'create'
): string {
    if (action === 'create') {
        return replace;
    }

    if (fileContent.includes(search)) {
        return fileContent.replace(search, replace);
    }

    const normalize = (str: string) => str.replace(/\s+/g, '').replace(/['"`]/g, '"');
    const normSearch = normalize(search);
    if (!normSearch) {
        throw new Error(`Empty search block for patch on file: ${filePath}`);
    }

    const normContent = normalize(fileContent);
    const matchIdx = normContent.indexOf(normSearch);

    if (matchIdx !== -1) {
        const mapIdx: number[] = [];
        let normPos = 0;
        for (let i = 0; i < fileContent.length; i++) {
            const char = fileContent[i];
            if (/\S/.test(char)) {
                mapIdx[normPos] = i;
                normPos++;
            }
        }

        const startOriginal = mapIdx[matchIdx];
        const endOriginal = mapIdx[matchIdx + normSearch.length - 1] + 1;

        if (startOriginal !== undefined && endOriginal !== undefined) {
            const before = fileContent.slice(0, startOriginal);
            const after = fileContent.slice(endOriginal);
            return before + replace + after;
        }
    }

    throw new Error(`Could not find search block in file ${filePath} for patching.\nSearch block:\n${search}`);
}

// ─── SSE Helper ─────────────────────────────────────────────────────────────

function sseEncode(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    let body: any = {};
    try {
        body = await request.json();
    } catch {
        // empty or malformed
    }
    const { topic, provider, apiKey, projectType, model, existingFiles, mode, prompt } = body as {
        topic: string;
        provider: string;
        apiKey: string;
        projectType?: string;
        model?: string;
        existingFiles?: GeneratedFile[];
        mode?: 'generate' | 'edit';
        prompt?: string;
    };

    if (!topic || !provider || !apiKey) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseEncode(event, data)));
            };

            try {
                if (mode === 'edit') {
                    send('phase', { phase: 'edit-plan', message: 'Analyzing edits...' });
                    send('agent-thinking', { agentName: 'Developer', agentColor: '#3B82F6' });

                    const projectStructure = (existingFiles || []).map(f => `  ${f.path}`).join('\n');
                    const editPrompt = buildEditPrompt(topic, prompt || '', existingFiles || [], projectStructure);
                    
                    let patchesRaw = await callLLM(editPrompt, provider, apiKey, model, 3000);
                    
                    const jsonMatch = patchesRaw.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    let patches: any[] = [];
                    try {
                        patches = JSON.parse(jsonMatch ? jsonMatch[0] : patchesRaw);
                    } catch (err) {
                        throw new Error(`Failed to parse edit patches JSON: ${patchesRaw}`);
                    }

                    send('phase', { phase: 'codegen', message: 'Applying patches...' });

                    const updatedFiles = [...(existingFiles || [])];

                    for (const patch of patches) {
                        const { file, action, search, replace } = patch;
                        send('file-start', {
                            path: file,
                            purpose: action === 'create' ? 'Creating file' : 'Patching file',
                            index: patches.indexOf(patch),
                            total: patches.length
                        });

                        const existingFileIdx = updatedFiles.findIndex(f => f.path === file);
                        let finalContent = '';

                        if (action === 'create') {
                            finalContent = replace;
                        } else {
                            if (existingFileIdx === -1) {
                                throw new Error(`File ${file} to be modified does not exist.`);
                            }
                            const originalContent = updatedFiles[existingFileIdx].content;
                            finalContent = applyPatch(file, originalContent, search, replace, action);
                        }

                        const language = detectLanguage(file);
                        const updatedFile = { path: file, content: finalContent, language };

                        if (existingFileIdx !== -1) {
                            updatedFiles[existingFileIdx] = updatedFile;
                        } else {
                            updatedFiles.push(updatedFile);
                        }

                        send('file-complete', {
                            path: file,
                            content: finalContent,
                            language,
                            index: patches.indexOf(patch),
                            total: patches.length
                        });
                    }

                    send('phase', { phase: 'complete', message: 'Patches applied successfully!' });
                    send('codegen-complete', {
                        totalFiles: updatedFiles.length,
                        files: updatedFiles
                    });
                    send('done', { success: true });
                    return;
                }

                // ── Phase 1: Architecture Planning ──────────────────
                send('phase', { phase: 'architect', message: 'Planning project architecture...' });
                send('agent-thinking', { agentName: 'System Architect', agentColor: '#10B981' });

                const archPrompt = buildArchitectPrompt(topic, projectType || 'Full Stack App');
                const archRaw = await callLLM(archPrompt, provider, apiKey, model, 1500);

                let architecture: any;
                try {
                    const jsonMatch = archRaw.match(/\{[\s\S]*\}/);
                    architecture = JSON.parse(jsonMatch ? jsonMatch[0] : archRaw);
                } catch {
                    architecture = {
                        projectName: 'my-app',
                        description: topic,
                        files: [
                            { path: 'package.json', purpose: 'Project dependencies and scripts', priority: 1 },
                            { path: 'vite.config.ts', purpose: 'Vite build configuration', priority: 1 },
                            { path: 'tailwind.config.ts', purpose: 'Tailwind CSS configuration', priority: 1 },
                            { path: 'tsconfig.json', purpose: 'TypeScript configuration', priority: 1 },
                            { path: 'src/main.tsx', purpose: 'Application entry point', priority: 1 },
                            { path: 'src/App.tsx', purpose: 'Main app with routing and layout', priority: 2 },
                            { path: 'src/lib/utils.ts', purpose: 'Utility functions including cn()', priority: 2 },
                            { path: 'src/lib/supabase.ts', purpose: 'Supabase client initialization', priority: 2 },
                            { path: 'src/components/Layout.tsx', purpose: 'Main layout with navigation', priority: 3 },
                        ],
                    };
                }

                send('architecture', {
                    projectName: architecture.projectName,
                    description: architecture.description,
                    files: architecture.files,
                    componentTree: architecture.componentTree,
                });

                // ── Phase 2: Code Generation ────────────────────────
                send('phase', { phase: 'codegen', message: 'Generating code files...' });

                const files = (architecture.files || []).sort(
                    (a: any, b: any) => (a.priority || 99) - (b.priority || 99)
                );
                const generated: GeneratedFile[] = existingFiles || [];
                const projectStructure = files.map((f: any) => `  ${f.path} — ${f.purpose}`).join('\n');

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    send('file-start', {
                        path: file.path,
                        purpose: file.purpose,
                        index: i,
                        total: files.length,
                    });

                    const codePrompt = buildCodegenPrompt(
                        topic,
                        file.path,
                        file.purpose,
                        projectStructure,
                        generated
                    );

                    const code = await callLLM(codePrompt, provider, apiKey, model, 4096);

                    // Clean up any markdown fences the model may have added
                    const cleaned = code
                        .replace(/^```[\w]*\n?/gm, '')
                        .replace(/```\s*$/gm, '')
                        .replace(/^```$/gm, '')
                        .trim();

                    const language = detectLanguage(file.path);
                    const genFile: GeneratedFile = {
                        path: file.path,
                        content: cleaned,
                        language,
                    };
                    generated.push(genFile);

                    send('file-complete', {
                        path: file.path,
                        content: cleaned,
                        language,
                        index: i,
                        total: files.length,
                    });
                }

                // ── Phase 3: Security Review ────────────────────────
                send('phase', { phase: 'security', message: 'Running security checks...' });
                send('agent-thinking', { agentName: 'Security Engineer', agentColor: '#F97316' });

                // Quick scan for common issues
                const securityIssues: string[] = [];
                for (const f of generated) {
                    if (f.content.includes('VITE_') && f.content.includes('secret')) {
                        securityIssues.push(`⚠️ ${f.path}: Possible secret exposed via VITE_ prefix (client-visible)`);
                    }
                    if (f.content.includes('dangerouslySetInnerHTML')) {
                        securityIssues.push(`⚠️ ${f.path}: Uses dangerouslySetInnerHTML — ensure input is sanitized`);
                    }
                }

                send('security-report', { issues: securityIssues });

                // ── Phase 4: Validation & Self-Healing ──────────────
                send('phase', { phase: 'validate', message: 'Validating generated code...' });

                const validationIssues: string[] = [];
                for (let vi = 0; vi < generated.length; vi++) {
                    const f = generated[vi];
                    if (f.language !== 'tsx' && f.language !== 'typescript' && f.language !== 'jsx' && f.language !== 'javascript') continue;

                    const issues: string[] = [];

                    // Check for leftover markdown fences
                    if (f.content.includes('```')) {
                        issues.push('Contains markdown code fences');
                    }

                    // Check for unmatched braces
                    const opens = (f.content.match(/\{/g) || []).length;
                    const closes = (f.content.match(/\}/g) || []).length;
                    if (Math.abs(opens - closes) > 1) {
                        issues.push(`Unmatched braces: ${opens} open vs ${closes} close`);
                    }

                    // Check for barrel re-exports that break bundling
                    if (/export\s+\*\s+from/.test(f.content) || /export\s*\{[^}]+\}\s*from/.test(f.content)) {
                        issues.push('Contains barrel re-export pattern (export * from / export {} from)');
                    }

                    // Check for truncated files (common LLM issue)
                    if (f.content.length > 100 && !f.content.trimEnd().endsWith('}') && !f.content.trimEnd().endsWith(';') && !f.content.trimEnd().endsWith(')') && f.path.endsWith('.tsx')) {
                        issues.push('File appears truncated — does not end with }, ;, or )');
                    }

                    // Check for cross-file import references to non-existent files
                    const importMatches = f.content.matchAll(/from\s+['"](\.\/.+?|@\/.+?)['"]/g);
                    for (const match of importMatches) {
                        const importPath = match[1];
                        if (importPath.startsWith('@/')) {
                            const resolved = 'src/' + importPath.slice(2);
                            const exists = generated.some(g =>
                                g.path === resolved || g.path === resolved + '.ts' || g.path === resolved + '.tsx'
                            );
                            if (!exists) issues.push(`Imports non-existent file: ${importPath}`);
                        }
                    }

                    if (issues.length > 0) {
                        validationIssues.push(`${f.path}: ${issues.join('; ')}`);

                        // Self-heal: ask LLM to fix the file (1 retry)
                        try {
                            const fixPrompt = `Fix the following code file. It has these issues:\n${issues.join('\n')}\n\nOriginal file (${f.path}):\n${f.content}\n\nRULES:\n- Output ONLY the fixed file content. No markdown fences, no explanations.\n- Do NOT use export * from or export {} from patterns.\n- Ensure all braces and brackets are properly matched.\n- Make the file complete and self-contained.`;
                            const fixed = await callLLM(fixPrompt, provider, apiKey, model, 4096);
                            const fixedClean = fixed.replace(/^\`\`\`[\w]*\n?/gm, '').replace(/\`\`\`\s*$/gm, '').trim();
                            if (fixedClean.length > 50) {
                                generated[vi] = { ...f, content: fixedClean };
                                send('file-complete', {
                                    path: f.path,
                                    content: fixedClean,
                                    language: f.language,
                                    index: vi,
                                    total: generated.length,
                                });
                            }
                        } catch { /* skip fix if LLM call fails */ }
                    }
                }

                if (validationIssues.length > 0) {
                    send('agent-thinking', { agentName: 'Code Validator', agentColor: '#8B5CF6' });
                }

                // ── Complete ────────────────────────────────────────
                send('phase', { phase: 'complete', message: 'Build complete!' });
                send('codegen-complete', {
                    projectName: architecture.projectName,
                    totalFiles: generated.length,
                    files: generated,
                });

                send('done', { success: true });
            } catch (err: any) {
                send('error', { message: err.message || 'Unknown error during code generation' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}

function detectLanguage(path: string): string {
    if (path.endsWith('.tsx')) return 'tsx';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.jsx')) return 'jsx';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.toml')) return 'toml';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
    return 'plaintext';
}
