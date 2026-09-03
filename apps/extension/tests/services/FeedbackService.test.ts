/**
 * Unit tests for FeedbackService
 */

import { FeedbackService, IssueSeverity } from '../../src/services/feedback/FeedbackService';
import * as fs from 'fs';
import * as path from 'path';

describe('FeedbackService', () => {
    let feedbackService: FeedbackService;
    let testWorkspace: string;

    beforeEach(() => {
        testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
        fs.mkdirSync(testWorkspace, { recursive: true });

        feedbackService = new FeedbackService(testWorkspace);
    });

    afterEach(() => {
        // Cleanup
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });

    describe('createFeedback', () => {
        it('should create feedback for an agent', () => {
            feedbackService.createFeedback(
                'TestAgent',
                ['Completed task 1', 'Completed task 2'],
                ['Remaining task 1'],
                [{ severity: 'medium', description: 'Test issue', context: 'test context' }],
                ['Suggestion 1'],
                ['Next step 1']
            );

            const feedback = feedbackService.getAgentFeedback('TestAgent');

            expect(feedback).toHaveLength(1);
            expect(feedback[0].completedTasks).toHaveLength(2);
            expect(feedback[0].issuesEncountered).toHaveLength(1);
            expect(feedback[0].issuesEncountered[0].severity).toBe('medium');
        });

        it('should save feedback to file', () => {
            feedbackService.createFeedback(
                'Agent1',
                ['Task 1'],
                [],
                [],
                [],
                []
            );

            const feedbackPath = path.join(testWorkspace, '.verno', 'feedback', 'Agent1');
            expect(fs.existsSync(feedbackPath)).toBe(true);

            const files = fs.readdirSync(feedbackPath);
            expect(files.length).toBeGreaterThan(0);
        });
    });

    describe('getFeedbackSummary', () => {
        it('should return summary of all feedback', () => {
            feedbackService.createFeedback(
                'Agent1',
                ['Completed A'],
                ['Remaining B'],
                [{ severity: 'high', description: 'Critical issue', context: 'ctx' }],
                ['Fix it'],
                ['Step 1']
            );

            feedbackService.createFeedback(
                'Agent2',
                ['Completed C'],
                [],
                [],
                [],
                []
            );

            const summary = feedbackService.getFeedbackSummary();

            expect(summary).toContain('Agent1');
            expect(summary).toContain('Agent2');
            expect(summary).toContain('Completed A');
            expect(summary).toContain('Critical issue');
        });
    });

    describe('getCriticalIssues', () => {
        it('should return only critical and high severity issues', () => {
            feedbackService.createFeedback(
                'Agent1',
                [],
                [],
                [
                    { severity: 'critical', description: 'Critical', context: 'ctx1' },
                    { severity: 'high', description: 'High', context: 'ctx2' },
                    { severity: 'medium', description: 'Medium', context: 'ctx3' },
                    { severity: 'low', description: 'Low', context: 'ctx4' }
                ],
                [],
                []
            );

            const criticalIssues = feedbackService.getCriticalIssues();

            expect(criticalIssues).toHaveLength(2);
            expect(criticalIssues[0].severity).toBe('critical');
            expect(criticalIssues[1].severity).toBe('high');
        });
    });
});
