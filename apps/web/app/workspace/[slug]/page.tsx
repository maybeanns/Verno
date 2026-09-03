'use client';

import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';

import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import WorkspaceLoading from '@/components/workspace/WorkspaceLoading';
import { parseWorkspaceRoute } from '@/lib/workspace-url';

function WorkspaceContent({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const search = useSearchParams();
    const values = parseWorkspaceRoute(slug, search);

    return (
        <WorkspaceLayout
            query={values.query}
            projectType={values.projectType}
            mode={values.mode}
            jobId={values.jobId}
            model={values.model}
            visibility={values.visibility}
            fastTrack={values.fastTrack}
        />
    );
}

export default function WorkspaceSlugPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    return (
        <Suspense fallback={<WorkspaceLoading />}>
            <WorkspaceContent params={params} />
        </Suspense>
    );
}
