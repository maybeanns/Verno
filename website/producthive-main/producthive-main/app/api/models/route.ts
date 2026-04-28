import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json([
        { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', provider: 'groq', costTier: 'free' },
        { id: 'canopylabs/orpheus-arabic-saudi', name: 'Orpheus Arabic Saudi', provider: 'groq', costTier: 'free' },
        { id: 'canopylabs/orpheus-v1-english', name: 'Orpheus v1 English', provider: 'groq', costTier: 'free' },
        { id: 'groq/compound', name: 'Groq Compound', provider: 'groq', costTier: 'free' },
        { id: 'groq/compound-mini', name: 'Groq Compound Mini', provider: 'groq', costTier: 'free' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', costTier: 'free' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', costTier: 'free' },
        { id: 'meta-llama/llama-4-scout-17b-16e-i...', name: 'Llama 4 Scout 17B', provider: 'groq', costTier: 'free' },
        { id: 'meta-llama/llama-prompt-guard-2-2...', name: 'Llama Prompt Guard 2 (2B)', provider: 'groq', costTier: 'free' },
        { id: 'meta-llama/llama-prompt-guard-2-8...', name: 'Llama Prompt Guard 2 (8B)', provider: 'groq', costTier: 'free' },
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', costTier: 'free' },
        { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', provider: 'groq', costTier: 'free' },
        { id: 'openai/gpt-oss-safeguard-20b', name: 'GPT OSS Safeguard 20B', provider: 'groq', costTier: 'free' }
    ]);
}
