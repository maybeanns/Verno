/**
 * Unit tests for ProgressIndicator
 */

import { ProgressIndicator, ProgressState } from '../../src/services/progress/ProgressIndicator';

describe('ProgressIndicator', () => {
    let progressIndicator: ProgressIndicator;

    beforeEach(() => {
        progressIndicator = new ProgressIndicator();
    });

    describe('initialize', () => {
        it('should initialize with stages', () => {
            const stages = ['analysis', 'design', 'development'];
            progressIndicator.initialize(stages);

            const state = progressIndicator.getState();
            expect(state.totalStages).toBe(3);
            expect(state.status).toBe('idle');
            expect(state.percentage).toBe(0);
        });
    });

    describe('Stage progression', () => {
        beforeEach(() => {
            progressIndicator.initialize(['stage1', 'stage2', 'stage3']);
        });

        it('should start a stage', () => {
            progressIndicator.startStage('stage1', 'Agent1');

            const state = progressIndicator.getState();
            expect(state.status).toBe('running');
            expect(state.currentStage).toBe('stage1');
            expect(state.currentAgent).toBe('Agent1');
            expect(state.percentage).toBe(0);
        });

        it('should complete a stage and update percentage', () => {
            progressIndicator.startStage('stage1', 'Agent1');
            progressIndicator.completeStage();

            const state = progressIndicator.getState();
            expect(state.completedStages).toBe(1);
            expect(Math.round(state.percentage)).toBe(33); // 1/3 complete
        });

        it('should calculate 100% when all stages complete', () => {
            progressIndicator.startStage('stage1', 'Agent1');
            progressIndicator.completeStage();

            progressIndicator.startStage('stage2', 'Agent2');
            progressIndicator.completeStage();

            progressIndicator.startStage('stage3', 'Agent3');
            progressIndicator.completeStage();

            const state = progressIndicator.getState();
            expect(state.completedStages).toBe(3);
            expect(state.percentage).toBe(100);
        });

        it('should mark as completed when complete() is called', () => {
            progressIndicator.complete();

            const state = progressIndicator.getState();
            expect(state.status).toBe('completed');
            expect(state.percentage).toBe(100);
        });
    });

    describe('Event listeners', () => {
        it('should notify listeners on state changes', () => {
            const listener = jest.fn();
            progressIndicator.addListener(listener);

            progressIndicator.initialize(['stage1']);
            progressIndicator.startStage('stage1', 'Agent1');

            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls[0][0].currentStage).toBe('stage1');
        });

        it('should allow removing listeners', () => {
            const listener = jest.fn();
            progressIndicator.addListener(listener);
            progressIndicator.removeListener(listener);

            progressIndicator.initialize(['stage1']);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        beforeEach(() => {
            progressIndicator.initialize(['stage1']);
            progressIndicator.startStage('stage1', 'Agent1');
        });

        it('should mark as error when error() is called', () => {
            progressIndicator.error('Test error');

            const state = progressIndicator.getState();
            expect(state.status).toBe('error');
        });
    });
});
