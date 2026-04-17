import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitStatusResult {
    isGitRepo: boolean;
    currentBranch: string | null;
    hasUncommittedChanges: boolean;
}

export class GitService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Helper to execute git commands safely in the workspace.
     */
    private async runGitCommand(args: string[]): Promise<string> {
        try {
            const { stdout } = await execFileAsync('git', args, { cwd: this.workspaceRoot });
            return stdout.trim();
        } catch (error: any) {
            throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
        }
    }

    /**
     * Checks if the workspace is inside a valid Git repository tree.
     */
    async isGitRepository(): Promise<boolean> {
        try {
            const result = await this.runGitCommand(['rev-parse', '--is-inside-work-tree']);
            return result === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Gets the current branch name.
     */
    async getCurrentBranch(): Promise<string | null> {
        if (!(await this.isGitRepository())) return null;
        try {
            return await this.runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']);
        } catch {
            return null;
        }
    }

    /**
     * Checks if there are any uncommitted changes.
     */
    async hasUncommittedChanges(): Promise<boolean> {
        if (!(await this.isGitRepository())) return false;
        try {
            const status = await this.runGitCommand(['status', '--porcelain']);
            return status.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Adds files to staging.
     * @param files Array of file paths relative to workspace root (' .' for all).
     */
    async add(files: string[] = ['.']): Promise<void> {
        if (!(await this.isGitRepository())) throw new Error("Not a git repository");
        await this.runGitCommand(['add', ...files]);
    }

    /**
     * Commits staged changes.
     * @param message Commit message.
     */
    async commit(message: string): Promise<void> {
        if (!(await this.isGitRepository())) throw new Error("Not a git repository");
        await this.runGitCommand(['commit', '-m', message]);
    }

    /**
     * Pushes commits to the remote.
     * @param remote Remote name (default 'origin')
     * @param branch Branch name (default current branch)
     */
    async push(remote: string = 'origin', branch?: string): Promise<void> {
        if (!(await this.isGitRepository())) throw new Error("Not a git repository");
        const targetBranch = branch || (await this.getCurrentBranch());
        if (!targetBranch) throw new Error("Could not determine current branch to push");
        
        await this.runGitCommand(['push', remote, targetBranch]);
    }

    /**
     * Returns the basic git status summary.
     */
    async getStatus(): Promise<GitStatusResult> {
        const isGitRepo = await this.isGitRepository();
        if (!isGitRepo) {
            return { isGitRepo: false, currentBranch: null, hasUncommittedChanges: false };
        }
        
        return {
            isGitRepo,
            currentBranch: await this.getCurrentBranch(),
            hasUncommittedChanges: await this.hasUncommittedChanges()
        };
    }
}
