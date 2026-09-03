"use strict";
/**
 * Unit tests for FeedbackService
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const FeedbackService_1 = require("../../src/services/feedback/FeedbackService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
describe('FeedbackService', () => {
    let feedbackService;
    let testWorkspace;
    beforeEach(() => {
        testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
        fs.mkdirSync(testWorkspace, { recursive: true });
        feedbackService = new FeedbackService_1.FeedbackService(testWorkspace);
    });
    afterEach(() => {
        // Cleanup
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });
    describe('createFeedback', () => {
        it('should create feedback for an agent', () => {
            feedbackService.createFeedback('TestAgent', ['Completed task 1', 'Completed task 2'], ['Remaining task 1'], [{ severity: 'medium', description: 'Test issue', context: 'test context' }], ['Suggestion 1'], ['Next step 1']);
            const feedback = feedbackService.getAgentFeedback('TestAgent');
            expect(feedback).toHaveLength(1);
            expect(feedback[0].completedTasks).toHaveLength(2);
            expect(feedback[0].issuesEncountered).toHaveLength(1);
            expect(feedback[0].issuesEncountered[0].severity).toBe('medium');
        });
        it('should save feedback to file', () => {
            feedbackService.createFeedback('Agent1', ['Task 1'], [], [], [], []);
            const feedbackPath = path.join(testWorkspace, '.verno', 'feedback', 'Agent1');
            expect(fs.existsSync(feedbackPath)).toBe(true);
            const files = fs.readdirSync(feedbackPath);
            expect(files.length).toBeGreaterThan(0);
        });
    });
    describe('getFeedbackSummary', () => {
        it('should return summary of all feedback', () => {
            feedbackService.createFeedback('Agent1', ['Completed A'], ['Remaining B'], [{ severity: 'high', description: 'Critical issue', context: 'ctx' }], ['Fix it'], ['Step 1']);
            feedbackService.createFeedback('Agent2', ['Completed C'], [], [], [], []);
            const summary = feedbackService.getFeedbackSummary();
            expect(summary).toContain('Agent1');
            expect(summary).toContain('Agent2');
            expect(summary).toContain('Completed A');
            expect(summary).toContain('Critical issue');
        });
    });
    describe('getCriticalIssues', () => {
        it('should return only critical and high severity issues', () => {
            feedbackService.createFeedback('Agent1', [], [], [
                { severity: 'critical', description: 'Critical', context: 'ctx1' },
                { severity: 'high', description: 'High', context: 'ctx2' },
                { severity: 'medium', description: 'Medium', context: 'ctx3' },
                { severity: 'low', description: 'Low', context: 'ctx4' }
            ], [], []);
            const criticalIssues = feedbackService.getCriticalIssues();
            expect(criticalIssues).toHaveLength(2);
            expect(criticalIssues[0].severity).toBe('critical');
            expect(criticalIssues[1].severity).toBe('high');
        });
    });
});
//# sourceMappingURL=FeedbackService.test.js.map