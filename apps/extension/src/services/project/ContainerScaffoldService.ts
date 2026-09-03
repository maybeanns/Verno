import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../workspace/WorkspaceIntelligence';
import { DOCKERFILE_TEMPLATES, DOCKERIGNORE_TEMPLATE, DOCKER_COMPOSE_TEMPLATES } from './templates/docker-templates';
import { HELM_CHART_TEMPLATE, HELM_VALUES_TEMPLATE, HELM_DEPLOYMENT_TEMPLATE, HELM_SERVICE_TEMPLATE, HELM_HELPERS_TEMPLATE } from './templates/helm-templates';

export class ContainerScaffoldService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Determines the stack format string.
     */
    private getStackKey(snapshot: WorkspaceSnapshot): string {
        const stack = (snapshot.stackSummary || '').toLowerCase();
        
        if (stack.includes('typescript') || stack.includes('javascript') || stack.includes('node') || stack.includes('react') || stack.includes('express')) {
            return 'typescript';
        }
        
        if (stack.includes('python') || stack.includes('django') || stack.includes('fastapi') || stack.includes('flask')) {
            return 'python';
        }

        return 'generic';
    }

    /**
     * Generates Dockerfile, .dockerignore, and docker-compose.yml.
     */
    async generateDockerArtifacts(snapshot: WorkspaceSnapshot): Promise<string[]> {
        const stackKey = this.getStackKey(snapshot);
        
        const dockerfilePath = path.join(this.workspaceRoot, 'Dockerfile');
        const dockerignorePath = path.join(this.workspaceRoot, '.dockerignore');
        const composePath = path.join(this.workspaceRoot, 'docker-compose.yml');

        const dockerfileContent = DOCKERFILE_TEMPLATES[stackKey];
        const composeContent = DOCKER_COMPOSE_TEMPLATES[stackKey];

        const generatedFiles: string[] = [];

        if (!fs.existsSync(dockerfilePath)) {
            fs.writeFileSync(dockerfilePath, dockerfileContent, 'utf-8');
            generatedFiles.push(dockerfilePath);
        }

        if (!fs.existsSync(dockerignorePath)) {
            fs.writeFileSync(dockerignorePath, DOCKERIGNORE_TEMPLATE, 'utf-8');
            generatedFiles.push(dockerignorePath);
        }

        if (!fs.existsSync(composePath)) {
            fs.writeFileSync(composePath, composeContent, 'utf-8');
            generatedFiles.push(composePath);
        }

        return generatedFiles;
    }

    /**
     * Generates a standard Helm chart structure in the helm/ directory.
     * @param projectName Name to be used for the chart
     */
    async generateHelmArtifacts(projectName: string): Promise<string[]> {
        const helmDir = path.join(this.workspaceRoot, 'helm', projectName);
        const templatesDir = path.join(helmDir, 'templates');

        // Create directories
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        const filesToWrite = {
            'Chart.yaml': HELM_CHART_TEMPLATE(projectName),
            'values.yaml': HELM_VALUES_TEMPLATE(projectName),
            'templates/deployment.yaml': HELM_DEPLOYMENT_TEMPLATE(projectName),
            'templates/service.yaml': HELM_SERVICE_TEMPLATE(projectName),
            'templates/_helpers.tpl': HELM_HELPERS_TEMPLATE(projectName)
        };

        const generatedFiles: string[] = [];

        for (const [relativePath, content] of Object.entries(filesToWrite)) {
            const filePath = path.join(helmDir, relativePath);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content, 'utf-8');
                generatedFiles.push(filePath);
            }
        }

        return generatedFiles;
    }
}
