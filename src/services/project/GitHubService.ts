import { GitService } from './GitService';

export class GitHubService {
    private gitService: GitService;

    constructor(private readonly workspaceRoot: string) {
        this.gitService = new GitService(workspaceRoot);
    }

    /**
     * Executes the "Direct Commit & Push" workflow defined in 08-CONTEXT.md.
     * It adds the provided files, commits them, and pushes to the current active branch.
     * 
     * @param files Files to add and commit
     * @param commitMessage Commit message
     */
    async commitAndPushScaffold(files: string[], commitMessage: string): Promise<string> {
        const status = await this.gitService.getStatus();
        
        if (!status.isGitRepo) {
            throw new Error("Active workspace is not a valid git repository. Cannot commit and push.");
        }

        if (!status.currentBranch) {
            throw new Error("Could not determine active git branch.");
        }

        try {
            // Add scaffold files
            await this.gitService.add(files);

            // Perform Commit
            await this.gitService.commit(commitMessage);

            // Push to current branch directly as specified in the context rules
            await this.gitService.push('origin', status.currentBranch);

            return `Success: Committed ${files.length} paths and pushed to origin/${status.currentBranch}`;
        } catch (error: any) {
            throw new Error(`Direct Commit & Push failed:\n${error.message}`);
        }
    }

    /**
     * Generates a template PR command for manual execution in case the push fails
     * or the user prefers to use `gh` CLI.
     */
    getManualPRCommand(title: string, body: string, baseBranch: string = 'main'): string {
        // Escaping simple quotes for generic shell usage
        const cleanTitle = title.replace(/"/g, '\\"');
        const cleanBody = body.replace(/"/g, '\\"');
        return `gh pr create --title "${cleanTitle}" --body "${cleanBody}" --base ${baseBranch}`;
    }
}
