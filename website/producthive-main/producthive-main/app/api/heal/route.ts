import { NextRequest, NextResponse } from 'next/server';

interface GeneratedFile {
    path: string;
    content: string;
    language: string;
}

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
                temperature: 0.2,
            }),
        });
    };

    let res = await makeRequest(model);

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

function buildHealPrompt(
    errorMsg: string,
    files: GeneratedFile[],
    projectStructure: string
): string {
    const fileContentsBlock = files
        .map(f => `=== FILE: ${f.path} ===\n${f.content}\n`)
        .join('\n');

    return `You are an expert React/TypeScript developer. A runtime or compilation error occurred in our Sandpack preview environment.
Original project files:
${fileContentsBlock}

Error Message & Stack Trace:
${errorMsg}

ENFORCED STACK:
- React 18+ with TypeScript
- Tailwind CSS
- shadcn/ui components (import from "@/components/ui/...")
- Supabase client from "@/lib/supabase"
- Vite

Your task is to fix the error. Identify the file causing the error and return a JSON patch to fix it.

Respond ONLY with a valid JSON array of patch objects. Do not include markdown code fences, do not include any commentary.
The structure of each patch object in the array must be:
{
  "file": "path/to/file",
  "action": "modify",
  "search": "exact code block to find",
  "replace": "new code block to replace it with"
}

Keep the search block as small as possible to avoid matching errors, but large enough to uniquely identify the section of the file to fix.
No placeholder or TODO comments in replace.`;
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

function detectLanguage(path: string): string {
    if (path.endsWith('.tsx')) return 'tsx';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.jsx')) return 'jsx';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { error, files, provider, apiKey, model } = body as {
            error: string;
            files: GeneratedFile[];
            provider: string;
            apiKey: string;
            model?: string;
        };

        if (!error || !files || !provider || !apiKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const projectStructure = files.map(f => `  ${f.path}`).join('\n');
        const prompt = buildHealPrompt(error, files, projectStructure);

        const patchesRaw = await callLLM(prompt, provider, apiKey, model, 2500);

        const jsonMatch = patchesRaw.match(/\[\s*\{[\s\S]*\}\s*\]/);
        let patches: any[] = [];
        try {
            patches = JSON.parse(jsonMatch ? jsonMatch[0] : patchesRaw);
        } catch (err) {
            return NextResponse.json({ error: `Failed to parse patch JSON: ${patchesRaw}` }, { status: 500 });
        }

        const updatedFiles = [...files];
        const patchedFilesList: string[] = [];

        for (const patch of patches) {
            const { file, action, search, replace } = patch;
            const existingFileIdx = updatedFiles.findIndex(f => f.path === file);

            if (existingFileIdx === -1 && action !== 'create') {
                continue;
            }

            const originalContent = existingFileIdx !== -1 ? updatedFiles[existingFileIdx].content : '';
            const finalContent = applyPatch(file, originalContent, search, replace, action);

            const language = detectLanguage(file);
            const updated = { path: file, content: finalContent, language };

            if (existingFileIdx !== -1) {
                updatedFiles[existingFileIdx] = updated;
            } else {
                updatedFiles.push(updated);
            }
            patchedFilesList.push(file);
        }

        return NextResponse.json({
            success: true,
            files: updatedFiles,
            patchedFiles: patchedFilesList
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Error during self-healing' }, { status: 500 });
    }
}
