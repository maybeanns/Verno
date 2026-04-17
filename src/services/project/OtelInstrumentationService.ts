import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../workspace/WorkspaceIntelligence';
import { OTEL_TEMPLATES } from './templates/otel-templates';

/**
 * Generates OpenTelemetry instrumentation files tailored to the detected stack.
 * Follows the same scaffold pattern as CiCdScaffoldService.
 */
export class OtelInstrumentationService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Detect the appropriate template based on the workspace stack.
     */
    private getTemplateForStack(snapshot: WorkspaceSnapshot): { template: string; filename: string } {
        const stack = (snapshot.stackSummary || '').toLowerCase();

        if (stack.includes('typescript') || stack.includes('javascript') || stack.includes('node') || stack.includes('react') || stack.includes('express')) {
            return { template: OTEL_TEMPLATES['typescript'], filename: 'instrumentation.ts' };
        }

        if (stack.includes('python') || stack.includes('django') || stack.includes('fastapi') || stack.includes('flask')) {
            return { template: OTEL_TEMPLATES['python'], filename: 'instrumentation.py' };
        }

        return { template: OTEL_TEMPLATES['generic'], filename: 'otel-entrypoint.sh' };
    }

    /**
     * Extract a reasonable service name from the workspace snapshot.
     */
    private getServiceName(snapshot: WorkspaceSnapshot): string {
        // Use the project directory name as the service name
        return path.basename(this.workspaceRoot).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    /**
     * Generate the OpenTelemetry instrumentation file and write it to the workspace root.
     */
    async generateInstrumentation(snapshot: WorkspaceSnapshot): Promise<string[]> {
        const { template, filename } = this.getTemplateForStack(snapshot);
        const serviceName = this.getServiceName(snapshot);

        // Replace the placeholder with the actual service name
        const content = template.replace(/\{\{SERVICE_NAME\}\}/g, serviceName);

        const targetPath = path.join(this.workspaceRoot, filename);
        fs.writeFileSync(targetPath, content, 'utf-8');

        return [targetPath];
    }
}
