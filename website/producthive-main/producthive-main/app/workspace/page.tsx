'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';

function WorkspaceContent() {
    const params = useSearchParams();

    const query = params.get('q') ?? '';
    const projectType = params.get('type') ?? 'Full Stack App';
    const mode = params.get('mode') ?? 'Generate PRD';
    const jobId = params.get('jobId') ?? undefined;
    const model = params.get('model') ?? undefined;
    const visibility = params.get('visibility') ?? 'public';

    return (
        <WorkspaceLayout
            query={query}
            projectType={projectType}
            mode={mode}
            jobId={jobId}
            model={model}
            visibility={visibility}
        />
    );
}

export default function WorkspacePage() {
    return (
        <Suspense fallback={
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading workspace…</p>
                </div>
            </div>
        }>
            <WorkspaceContent />
        </Suspense>
    );
}
