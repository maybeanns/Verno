import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../workspace/WorkspaceIntelligence';
import { LLMService } from '../llm';

/**
 * Built-in failure catalogue — common operational failure modes
 * that apply to most services regardless of stack.
 */
const FAILURE_CATALOGUE = [
    {
        title: 'Out of Memory (OOM)',
        detection: 'Container killed by OOM killer; Kubernetes pod status `OOMKilled`; sudden process restarts with exit code 137.',
        diagnosis: 'Check memory usage graphs in Grafana. Inspect heap dumps or `top`/`htop`. Look for memory leaks in recent deployments.',
        mitigation: 'Increase container memory limits. Restart affected pods. Roll back if caused by a recent deployment.',
        prevention: 'Set memory limits in Kubernetes manifests. Add memory usage alerts at 80% threshold. Profile memory in staging before production deploys.',
    },
    {
        title: 'Connection Refused / Upstream Timeout',
        detection: 'HTTP 502/503 errors spike. Logs show `ECONNREFUSED` or `connection timed out`. Downstream health checks fail.',
        diagnosis: 'Verify downstream service is running. Check network policies and DNS resolution. Inspect connection pool exhaustion.',
        mitigation: 'Restart the downstream service. Increase connection pool size. Enable circuit breaker to prevent cascade.',
        prevention: 'Implement circuit breakers (e.g. Hystrix, resilience4j). Configure retry with exponential backoff. Add readiness probes.',
    },
    {
        title: 'TLS Certificate Expiry',
        detection: 'Clients receive TLS handshake errors. Monitoring alerts on certificate expiry date < 7 days. Browser shows "Not Secure".',
        diagnosis: 'Run `openssl s_client -connect host:443` to inspect certificate. Check cert-manager logs if using automated renewal.',
        mitigation: 'Manually renew and deploy the certificate. Restart ingress controller or load balancer to pick up new cert.',
        prevention: 'Use cert-manager with auto-renewal. Set monitoring alerts at 30-day and 7-day expiry thresholds.',
    },
    {
        title: 'Rate Limiting / Throttling',
        detection: 'HTTP 429 responses increase. API consumers report degraded performance. Rate limiter metrics show high rejection rate.',
        diagnosis: 'Identify which clients or endpoints are hitting limits. Check if limits are configured correctly for expected traffic.',
        mitigation: 'Temporarily increase rate limits for affected clients. Scale up backend capacity. Implement request queuing.',
        prevention: 'Set per-client rate limits. Implement adaptive rate limiting. Communicate limits via API documentation and response headers.',
    },
    {
        title: 'Disk Full / Storage Exhaustion',
        detection: 'Write operations fail. Logs show `ENOSPC`. Database queries fail with storage errors. Disk usage alerts fire.',
        diagnosis: 'Check disk usage with `df -h`. Identify large files with `du -sh`. Inspect log rotation and data retention policies.',
        mitigation: 'Delete old logs and temporary files. Expand volume size. Move data to object storage.',
        prevention: 'Configure log rotation. Set disk usage alerts at 80%. Implement data retention policies. Use external log aggregation.',
    },
    {
        title: 'Dependency / Third-Party API Outage',
        detection: 'External API calls return errors or time out. Feature degradation reported by users. Health check for external dependency fails.',
        diagnosis: 'Check third-party status pages. Inspect error responses for rate limiting vs. outage. Review dependency health dashboard.',
        mitigation: 'Activate fallback/cached responses. Enable graceful degradation mode. Communicate status to users.',
        prevention: 'Implement circuit breakers for external calls. Cache critical responses. Design for graceful degradation from the start.',
    },
];

export class RunbookGeneratorService {
    constructor(
        private readonly workspaceRoot: string,
        private readonly llmService: LLMService
    ) {}

    /**
     * Read ARCHITECTURE.md if present for project-specific context.
     */
    private readArchitectureContext(): string {
        const candidates = [
            path.join(this.workspaceRoot, '.verno', 'ARCHITECTURE.md'),
            path.join(this.workspaceRoot, 'ARCHITECTURE.md'),
            path.join(this.workspaceRoot, 'docs', 'ARCHITECTURE.md'),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                try {
                    return fs.readFileSync(candidate, 'utf-8');
                } catch {
                    // ignore read errors
                }
            }
        }

        return '';
    }

    /**
     * Generate the built-in failure catalogue section (no LLM needed).
     */
    private generateCatalogueSection(): string {
        return FAILURE_CATALOGUE.map(f => `
## ${f.title}

### Detection
${f.detection}

### Diagnosis
${f.diagnosis}

### Mitigation
${f.mitigation}

### Prevention
${f.prevention}
`).join('\n---\n');
    }

    /**
     * Generate a project-specific runbook section using the LLM.
     */
    private async generateProjectSpecificSection(snapshot: WorkspaceSnapshot, archContext: string): Promise<string> {
        const serviceName = path.basename(this.workspaceRoot);
        const stack = snapshot.stackSummary || 'unknown';

        const prompt = `You are a Site Reliability Engineer writing an operational runbook for a service called "${serviceName}" (stack: ${stack}).

${archContext ? `The following is the project's architecture document:\n\n${archContext.substring(0, 3000)}\n\n` : ''}

Based on this context, generate 2-3 **project-specific** failure scenarios that are unique to this service's architecture and stack. For each scenario, provide:
1. **Title** — a descriptive name
2. **Detection** — how the team would notice this failure
3. **Diagnosis** — investigation steps
4. **Mitigation** — immediate fix actions
5. **Prevention** — long-term prevention measures

Format as Markdown with ## headings. Return ONLY the Markdown content.`;

        try {
            return await this.llmService.generateText(prompt);
        } catch {
            return '\n## Project-Specific Scenarios\n\n_LLM generation unavailable. Add project-specific failure scenarios manually._\n';
        }
    }

    /**
     * Generate the complete runbook and write it to disk.
     */
    async generateRunbook(snapshot: WorkspaceSnapshot): Promise<string[]> {
        const serviceName = path.basename(this.workspaceRoot);
        const archContext = this.readArchitectureContext();

        // Build the runbook from both sources
        const catalogueSection = this.generateCatalogueSection();
        const projectSection = await this.generateProjectSpecificSection(snapshot, archContext);

        const runbook = `# Operational Runbook — ${serviceName}

> Auto-generated by Verno SDLC Pipeline (Phase 9: Monitoring & Observability)
> Generated: ${new Date().toISOString().split('T')[0]}

## Table of Contents
- [Common Failure Scenarios](#common-failure-scenarios)
- [Project-Specific Scenarios](#project-specific-scenarios)
- [Escalation Contacts](#escalation-contacts)

---

# Common Failure Scenarios

${catalogueSection}

---

# Project-Specific Scenarios

${projectSection}

---

# Escalation Contacts

| Role | Contact | Response Time |
|------|---------|---------------|
| On-Call Engineer | _TBD_ | 15 min |
| Service Owner | _TBD_ | 1 hour |
| Platform Team | _TBD_ | 2 hours |
| Security Team | _TBD_ | 30 min (security incidents) |

---

_This runbook should be reviewed and updated after every major incident or architecture change._
`;

        const outputDir = path.join(this.workspaceRoot, '.verno', 'observability');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const targetPath = path.join(outputDir, 'RUNBOOK.md');
        fs.writeFileSync(targetPath, runbook, 'utf-8');

        return [targetPath];
    }
}
