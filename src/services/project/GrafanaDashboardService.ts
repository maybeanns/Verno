import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../workspace/WorkspaceIntelligence';
import { generateGrafanaDashboard } from './templates/grafana-templates';

/**
 * Generates a portable Grafana dashboard JSON for the detected service.
 * Output is written to `.verno/observability/grafana-dashboard.json`.
 */
export class GrafanaDashboardService {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Extract a reasonable service name from the workspace.
     */
    private getServiceName(_snapshot: WorkspaceSnapshot): string {
        return path.basename(this.workspaceRoot).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    /**
     * Generate the Grafana dashboard JSON and write it to disk.
     */
    async generateDashboard(snapshot: WorkspaceSnapshot): Promise<string[]> {
        const serviceName = this.getServiceName(snapshot);
        const dashboard = generateGrafanaDashboard(serviceName);

        const outputDir = path.join(this.workspaceRoot, '.verno', 'observability');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const targetPath = path.join(outputDir, 'grafana-dashboard.json');
        fs.writeFileSync(targetPath, JSON.stringify(dashboard, null, 2), 'utf-8');

        return [targetPath];
    }
}
