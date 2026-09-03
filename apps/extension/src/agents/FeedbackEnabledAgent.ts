/**
 * Enhanced Base Agent with Feedback Support
 * Extension module for adding feedback generation to existing agents
 */

import { BaseAgent } from './base/BaseAgent';
import { FeedbackService, Issue, IssueSeverity } from '../services/feedback';

/**
 * Agent with feedback capabilities
 */
export abstract class FeedbackEnabledAgent extends BaseAgent {
    protected feedbackService: FeedbackService | null = null;

    /**
     * Initialize feedback service
     */
    initializeFeedback(workspaceRoot: string): void {
        this.feedbackService = new FeedbackService(workspaceRoot);
    }

    /**
     * Generate feedback after task execution
     */
    protected async generateFeedback(params: {
        agentName: string;
        completedTasks: string[];
        remainingWork: string[];
        issuesEncountered: Issue[];
        suggestions: string[];
        nextSteps: string[];
    }): Promise<void> {
        if (!this.feedbackService) {
            this.logger?.warn('Feedback service not initialized');
            return;
        }

        this.feedbackService.createFeedback(
            params.agentName,
            params.completedTasks,
            params.remainingWork,
            params.issuesEncountered,
            params.suggestions,
            params.nextSteps
        );
    }

    /**
     * Create issue helper
     */
    protected createIssue(
        severity: IssueSeverity,
        description: string,
        context: string
    ): Issue {
        return { severity, description, context };
    }
}
