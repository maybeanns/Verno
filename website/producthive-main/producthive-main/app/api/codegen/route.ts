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
- Always include: package.json, vite.config.ts, tailwind.config.ts, tsconfig.json, src/App.tsx, src/main.tsx
- Use shadcn/ui components: Button, Card, Input, Dialog, etc.
- Include a src/lib/supabase.ts for the Supabase client
- No placeholder or TODO files — every file must have a clear purpose`;
}

function buildCodegenPrompt(
    topic: string,
    filePath: string,
    filePurpose: string,
    projectStructure: string,
    existingFiles: GeneratedFile[]
): string {
    // Selective context: only feed relevant neighboring files
    const relevantFiles = selectRelevantContext(filePath, existingFiles);
    const contextBlock = relevantFiles.length > 0
        ? `\nRELEVANT EXISTING FILES (for imports/consistency):\n${relevantFiles.map(f => `--- ${f.path} ---\n${f.content.slice(0, 600)}\n`).join('\n')}`
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
- Tailwind CSS (utility-first, no custom CSS)
- shadcn/ui components (import from "@/components/ui/...")
- Supabase client from "@/lib/supabase"
- Vite (import.meta.env for env vars)

RULES:
- Output ONLY the raw file content. No markdown fences, no explanations.
- Use proper TypeScript types — no \`any\`.
- Use shadcn/ui components (Button, Card, Input, Dialog, Badge, etc.) — don't build from scratch.
- Import cn from "@/lib/utils" for className merging.
- Use Tailwind only — zero CSS files, zero styled-components.
- For Supabase: use createClient from @supabase/supabase-js with import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
- Make it production-quality. Real placeholder data, real UX.
- If it's a page component, make it visually polished with proper spacing, colors, hover states.`;
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
    const { topic, provider, apiKey, projectType, model, existingFiles } = body as {
        topic: string;
        provider: string;
        apiKey: string;
        projectType?: string;
        model?: string;
        existingFiles?: GeneratedFile[];
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

                    const code = await callLLM(codePrompt, provider, apiKey, model, 3000);

                    // Clean up any markdown fences the model may have added
                    const cleaned = code
                        .replace(/^```[\w]*\n?/gm, '')
                        .replace(/```$/gm, '')
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
