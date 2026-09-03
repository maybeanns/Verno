/** Shared placeholder while the workspace route resolves. */
export default function WorkspaceLoading() {
    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading workspace…</p>
            </div>
        </div>
    );
}
