/**
 * SprintPlannerAgent — distributes SDLC stories across sprints using:
 *  1. Topological sort on `dependsOn` fields (dependency-aware ordering)
 *  2. Bin-packing: fill current sprint until capacity, then start new sprint
 *  3. Critical path detection (longest dependency chain → Sprint 1 priority)
 *
 * Sprint plans are persisted to `.verno/sprint-plan.json` via VernoArtifactService.
 * Sprint creation and bulk-move to Jira is handled by JiraSyncService.
 */

import * as vscode from 'vscode';
import { Story, Epic } from '../../types/sdlc';
import { SprintPlan, Sprint } from '../../types/sprint';
import { VernoArtifactService } from '../../services/artifact/VernoArtifactService';
import { Logger } from '../../utils/logger';
import { TraceabilityMatrixService } from '../../services/project/TraceabilityMatrixService';
import { DependencyGraphService } from '../../services/project/DependencyGraphService';

export class SprintPlannerAgent {

    private traceService = new TraceabilityMatrixService();
    private depGraphService = new DependencyGraphService();

    constructor(
        private readonly logger: Logger
    ) {}

    /**
     * Build and persist a sprint plan from a flat list of epics.
     *
     * @param epics   The task-broken-down epics with stories and story points.
     * @param capacityPerSprint  Team capacity in story points per sprint.
     */
    public plan(epics: Epic[], capacityPerSprint: number): SprintPlan {
        const allStories = this.flattenStories(epics);
        const criticalPath = this.findCriticalPath(allStories);
        const sorted = this.topologicalSort(allStories);
        const sprints = this.binPack(sorted, capacityPerSprint, criticalPath);

        const plan: SprintPlan = {
            capacityPerSprint,
            totalStoryPoints: allStories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0),
            criticalPath,
            sprints,
            generatedAt: Date.now(),
        };

        this.persist(plan);
        this.logger.info(`[SprintPlannerAgent] Generated ${sprints.length} sprints for ${allStories.length} stories`);
        
        // Generate post-planning artifacts
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
            this.traceService.generateMatrix(root, epics);
            this.depGraphService.generateMermaidGraph(root, allStories);
        }
        
        return plan;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Flatten all stories out of epics into a single list. */
    private flattenStories(epics: Epic[]): Story[] {
        return epics.flatMap(e => e.stories);
    }

    /**
     * Topological sort on `dependsOn` array field.
     * Stories without dependencies come first; blocked stories are deferred.
     * Falls back to original order if there are no dependency annotations.
     */
    private topologicalSort(stories: Story[]): Story[] {
        const idMap = new Map<string, Story>(stories.map(s => [s.id, s]));
        const visited = new Set<string>();
        const result: Story[] = [];

        const visit = (story: Story) => {
            if (visited.has(story.id)) { return; }
            visited.add(story.id);
            const deps = (story as any).dependsOn as string[] | undefined;
            if (deps) {
                for (const depId of deps) {
                    const dep = idMap.get(depId);
                    if (dep) { visit(dep); }
                }
            }
            result.push(story);
        };

        for (const story of stories) {
            visit(story);
        }
        return result;
    }

    /**
     * Simple greedy bin-packing.
     * Critical path stories are promoted to Sprint 1 first (regardless of capacity).
     */
    private binPack(sorted: Story[], capacity: number, criticalPath: string[]): Sprint[] {
        const sprints: Sprint[] = [];

        // Partition: critical path stories first, then the rest in topological order
        const critical = sorted.filter(s => criticalPath.includes(s.id));
        const normal = sorted.filter(s => !criticalPath.includes(s.id));
        const ordered = [...critical, ...normal];

        let current: Sprint = { number: 1, name: 'Sprint 1', stories: [], totalPoints: 0 };
        sprints.push(current);

        for (const story of ordered) {
            const pts = story.storyPoints ?? 1; // default 1 point if unestimated
            if (current.totalPoints + pts > capacity && current.stories.length > 0) {
                const next: Sprint = {
                    number: sprints.length + 1,
                    name: `Sprint ${sprints.length + 1}`,
                    stories: [],
                    totalPoints: 0,
                };
                sprints.push(next);
                current = next;
            }
            current.stories.push(story);
            current.totalPoints += pts;
        }

        return sprints;
    }

    /**
     * Critical path = story IDs on the longest chain of dependencies.
     * Uses dynamic programming over the dependency DAG.
     */
    private findCriticalPath(stories: Story[]): string[] {
        const idMap = new Map<string, Story>(stories.map(s => [s.id, s]));
        const memo = new Map<string, string[]>();

        const longestChain = (story: Story): string[] => {
            if (memo.has(story.id)) { return memo.get(story.id)!; }
            const deps = (story as any).dependsOn as string[] | undefined;
            if (!deps || deps.length === 0) {
                memo.set(story.id, [story.id]);
                return [story.id];
            }
            let best: string[] = [];
            for (const depId of deps) {
                const dep = idMap.get(depId);
                if (dep) {
                    const chain = longestChain(dep);
                    if (chain.length > best.length) { best = chain; }
                }
            }
            const result = [...best, story.id];
            memo.set(story.id, result);
            return result;
        };

        let globalBest: string[] = [];
        for (const story of stories) {
            const chain = longestChain(story);
            if (chain.length > globalBest.length) { globalBest = chain; }
        }
        return globalBest;
    }

    /** Write sprint-plan.json to .verno/ */
    private persist(plan: SprintPlan): void {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) { return; }
        new VernoArtifactService(root).writeJSON('sprint-plan.json', plan);
    }
}
