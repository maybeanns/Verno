import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../workspace/WorkspaceIntelligence';
import { CI_WORKFLOW_TEMPLATES } from './templates/ci-workflows';

export class CiCdScaffoldService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Determines the most appropriate template based on the WorkspaceSnapshot's detected stack.
     */
    private getTemplateForStack(snapshot: WorkspaceSnapshot): string {
        const stack = (snapshot.stackSummary || '').toLowerCase();
        
        if (stack.includes('typescript') || stack.includes('javascript') || stack.includes('node') || stack.includes('react') || stack.includes('express')) {
            return CI_WORKFLOW_TEMPLATES['typescript'];
        }
        
        if (stack.includes('python') || stack.includes('django') || stack.includes('fastapi') || stack.includes('flask')) {
            return CI_WORKFLOW_TEMPLATES['python'];
        }

        return CI_WORKFLOW_TEMPLATES['generic'];
    }

    /**
     * Generates the GitHub Actions workflow scaffold and writes it to the disk.
     */
    async generateCiWorkflow(snapshot: WorkspaceSnapshot): Promise<string[]> {
        const workflowsDir = path.join(this.workspaceRoot, '.github', 'workflows');
        const targetFile = path.join(workflowsDir, 'ci.yml');

        // Create directories if not present
        if (!fs.existsSync(workflowsDir)) {
            fs.mkdirSync(workflowsDir, { recursive: true });
        }

        const templateContent = this.getTemplateForStack(snapshot);

        fs.writeFileSync(targetFile, templateContent, 'utf-8');

        return [targetFile];
    }
}
