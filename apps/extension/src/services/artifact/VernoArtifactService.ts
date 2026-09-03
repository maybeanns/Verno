/**
 * Centralized artifact path management for Verno.
 * All generated files (PRD, tasks, SDLC state, sprint plans, etc.) are written
 * to `.verno/` inside the workspace root. No agent should write to the root directly.
 *
 * Usage:
 *   const artifacts = new VernoArtifactService(workspaceRoot);
 *   const prdPath = artifacts.getPath('prd.json');
 *   artifacts.write('prd.json', JSON.stringify(prd));
 */

import * as fs from 'fs';
import * as path from 'path';

export type ArtifactName =
    | 'sdlc-state.json'
    | 'prd.json'
    | 'tasks.json'
    | 'tasks.md'
    | 'sprint-plan.json'
    | 'jira-config.json'
    | 'conversation-history.json'
    | string; // allow arbitrary filenames

export class VernoArtifactService {
    private readonly vernoDir: string;

    constructor(workspaceRoot: string) {
        this.vernoDir = path.join(workspaceRoot, '.verno');
        this.ensureDir();
    }

    /** Absolute path to a named artifact inside .verno/ */
    getPath(name: ArtifactName): string {
        return path.join(this.vernoDir, name);
    }

    /** Read artifact text. Returns null if not found. */
    read(name: ArtifactName): string | null {
        const p = this.getPath(name);
        if (!fs.existsSync(p)) { return null; }
        return fs.readFileSync(p, 'utf-8');
    }

    /** Read and parse JSON artifact. Returns null if not found or malformed. */
    readJSON<T = unknown>(name: ArtifactName): T | null {
        const raw = this.read(name);
        if (!raw) { return null; }
        try { return JSON.parse(raw) as T; } catch { return null; }
    }

    /** Write raw string to an artifact. Creates .verno/ if needed. */
    write(name: ArtifactName, content: string): void {
        this.ensureDir();
        fs.writeFileSync(this.getPath(name), content, 'utf-8');
    }

    /** Write JSON (pretty-printed) to an artifact. */
    writeJSON(name: ArtifactName, data: unknown): void {
        this.write(name, JSON.stringify(data, null, 2));
    }

    /** True if artifact exists on disk. */
    exists(name: ArtifactName): boolean {
        return fs.existsSync(this.getPath(name));
    }

    /** Delete an artifact if it exists. */
    delete(name: ArtifactName): void {
        const p = this.getPath(name);
        if (fs.existsSync(p)) { fs.unlinkSync(p); }
    }

    /** List all files currently in .verno/ */
    list(): string[] {
        if (!fs.existsSync(this.vernoDir)) { return []; }
        return fs.readdirSync(this.vernoDir);
    }

    private ensureDir(): void {
        if (!fs.existsSync(this.vernoDir)) {
            fs.mkdirSync(this.vernoDir, { recursive: true });
        }
    }
}
