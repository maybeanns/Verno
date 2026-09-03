/**
 * Feedback Service: Manages agent feedback collection and aggregation
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Issue severity levels
 */
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Issue interface
 */
export interface Issue {
    severity: IssueSeverity;
    description: string;
    context: string;
}

/**
 * Agent feedback interface
 */
export interface AgentFeedback {
    agentName: string;
    timestamp: number;
    completedTasks: string[];
    remainingWork: string[];
    issuesEncountered: Issue[];
    suggestions: string[];
    nextSteps: string[];
}

/**
 * Service for managing agent feedback
 */
export class FeedbackService {
    private workspaceRoot: string;
    private feedbackDir: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.feedbackDir = path.join(workspaceRoot, '.verno', 'feedback');
        this.ensureDirectoryExists();
    }

    /**
     * Create feedback for an agent
     */
    createFeedback(
        agentName: string,
        completedTasks: string[],
        remainingWork: string[],
        issuesEncountered: Issue[],
        suggestions: string[],
        nextSteps: string[]
    ): AgentFeedback {
        const feedback: AgentFeedback = {
            agentName,
            timestamp: Date.now(),
            completedTasks,
            remainingWork,
            issuesEncountered,
            suggestions,
            nextSteps,
        };

        this.saveFeedback(feedback);
        return feedback;
    }

    /**
     * Get the latest feedback for an agent
     */
    getLatestFeedback(agentName: string): AgentFeedback | null {
        const agentDir = path.join(this.feedbackDir, agentName);
        if (!fs.existsSync(agentDir)) {
            return null;
        }

        const files = fs.readdirSync(agentDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        if (files.length === 0) {
            return null;
        }

        const filePath = path.join(agentDir, files[0]);
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as AgentFeedback;
    }

    /**
     * Get all feedback for an agent
     */
    getAllFeedback(agentName: string): AgentFeedback[] {
        const agentDir = path.join(this.feedbackDir, agentName);
        if (!fs.existsSync(agentDir)) {
            return [];
        }

        const files = fs.readdirSync(agentDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        return files.map(file => {
            const filePath = path.join(agentDir, file);
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data) as AgentFeedback;
        });
    }

    /**
     * Get feedback from all agents
     */
    getAllAgentsFeedback(): Map<string, AgentFeedback[]> {
        const feedbackMap = new Map<string, AgentFeedback[]>();

        if (!fs.existsSync(this.feedbackDir)) {
            return feedbackMap;
        }

        const agentDirs = fs.readdirSync(this.feedbackDir)
            .filter(f => {
                const stat = fs.statSync(path.join(this.feedbackDir, f));
                return stat.isDirectory();
            });

        for (const agentName of agentDirs) {
            const feedback = this.getAllFeedback(agentName);
            if (feedback.length > 0) {
                feedbackMap.set(agentName, feedback);
            }
        }

        return feedbackMap;
    }

    /**
     * Get aggregated feedback summary
     */
    getFeedbackSummary(): string {
        let summary = '# Feedback Summary\n\n';
        const allFeedback = this.getAllAgentsFeedback();

        for (const [agentName, feedbackList] of allFeedback.entries()) {
            const latest = feedbackList[0];
            if (!latest) continue;

            summary += `## ${agentName}\n`;
            summary += `Last Updated: ${new Date(latest.timestamp).toLocaleString()}\n\n`;

            summary += `### Completed Tasks\n`;
            latest.completedTasks.forEach(task => {
                summary += `- ✓ ${task}\n`;
            });
            summary += '\n';

            summary += `### Remaining Work\n`;
            latest.remainingWork.forEach(work => {
                summary += `- [ ] ${work}\n`;
            });
            summary += '\n';

            if (latest.issuesEncountered.length > 0) {
                summary += `### Issues Encountered\n`;
                latest.issuesEncountered.forEach(issue => {
                    const icon = this.getSeverityIcon(issue.severity);
                    summary += `- ${icon} **${issue.severity.toUpperCase()}**: ${issue.description}\n`;
                    summary += `  Context: ${issue.context}\n`;
                });
                summary += '\n';
            }

            if (latest.suggestions.length > 0) {
                summary += `### Suggestions\n`;
                latest.suggestions.forEach(suggestion => {
                    summary += `- 💡 ${suggestion}\n`;
                });
                summary += '\n';
            }

            if (latest.nextSteps.length > 0) {
                summary += `### Next Steps\n`;
                latest.nextSteps.forEach(step => {
                    summary += `- ➡️ ${step}\n`;
                });
                summary += '\n';
            }

            summary += '---\n\n';
        }

        return summary;
    }

    /**
     * Get critical issues from all agents
     */
    getCriticalIssues(): Issue[] {
        const allFeedback = this.getAllAgentsFeedback();
        const criticalIssues: Issue[] = [];

        for (const feedbackList of allFeedback.values()) {
            const latest = feedbackList[0];
            if (latest) {
                const critical = latest.issuesEncountered.filter(
                    issue => issue.severity === 'critical' || issue.severity === 'high'
                );
                criticalIssues.push(...critical);
            }
        }

        return criticalIssues;
    }

    /**
     * Clear all feedback for an agent
     */
    clearAgentFeedback(agentName: string): void {
        const agentDir = path.join(this.feedbackDir, agentName);
        if (fs.existsSync(agentDir)) {
            fs.rmSync(agentDir, { recursive: true, force: true });
        }
    }

    /**
     * Clear all feedback
     */
    clearAllFeedback(): void {
        if (fs.existsSync(this.feedbackDir)) {
            fs.rmSync(this.feedbackDir, { recursive: true, force: true });
            this.ensureDirectoryExists();
        }
    }

    /**
     * Save feedback to disk
     */
    private saveFeedback(feedback: AgentFeedback): void {
        try {
            const agentDir = path.join(this.feedbackDir, feedback.agentName);
            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true });
            }

            const filename = `feedback-${feedback.timestamp}.json`;
            const filePath = path.join(agentDir, filename);
            fs.writeFileSync(filePath, JSON.stringify(feedback, null, 2), 'utf-8');
        } catch (err) {
            console.error(`Failed to save feedback for ${feedback.agentName}:`, err);
        }
    }

    /**
     * Ensure feedback directory exists
     */
    private ensureDirectoryExists(): void {
        if (!fs.existsSync(this.feedbackDir)) {
            fs.mkdirSync(this.feedbackDir, { recursive: true });
        }
    }

    /**
     * Get severity icon
     */
    private getSeverityIcon(severity: IssueSeverity): string {
        switch (severity) {
            case 'critical':
                return '🔴';
            case 'high':
                return '🟠';
            case 'medium':
                return '🟡';
            case 'low':
                return '🟢';
            default:
                return '⚪';
        }
    }
}
