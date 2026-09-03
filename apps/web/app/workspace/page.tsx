'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import WorkspaceLoading from '@/components/workspace/WorkspaceLoading';
import { legacyWorkspacePath } from '@/lib/workspace-url';

/**
 * Links shared before the slug routes existed still arrive here as
 * `/workspace?q=…`. Upgrade them in place rather than breaking them.
 */
function LegacyWorkspaceRedirect() {
    const router = useRouter();
    const search = useSearchParams();

    useEffect(() => {
        router.replace(legacyWorkspacePath(search) ?? '/');
    }, [router, search]);

    return <WorkspaceLoading />;
}

export default function WorkspacePage() {
    return (
        <Suspense fallback={<WorkspaceLoading />}>
            <LegacyWorkspaceRedirect />
        </Suspense>
    );
}
