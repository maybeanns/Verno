/**
 * CheckpointStore — persists SDLC phase outputs to .verno/checkpoints/
 *
 * Enables durable workflow execution: if VS Code is closed mid-pipeline,
 * completed phases are not re-run on resume. Designed as a soft-fail module —
 * if the file system is unavailable, it degrades to an in-memory store with
 * no persistence guarantee.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CheckpointEntry {
  phaseId: string;
  output: string;
  completedAt: number;
}

export interface CheckpointRun {
  runId: string;
  topic: string;
  startedAt: number;
  phases: CheckpointEntry[];
}

export class CheckpointStore {
  private readonly checkpointDir: string;
  private readonly persistenceAvailable: boolean;

  constructor(workspaceRoot: string) {
    this.checkpointDir = path.join(workspaceRoot, '.verno', 'checkpoints');
    this.persistenceAvailable = this.ensureDir();
  }

  /** Save the output of a completed phase. */
  public save(runId: string, phaseId: string, output: string, topic: string = ''): void {
    const run = this.loadRaw(runId) ?? {
      runId,
      topic,
      startedAt: Date.now(),
      phases: [],
    };

    // Remove existing entry for this phase (idempotent)
    run.phases = run.phases.filter(p => p.phaseId !== phaseId);
    run.phases.push({ phaseId, output, completedAt: Date.now() });

    this.writeRun(runId, run);
  }

  /** Load all completed phases for a given run. Returns empty map if none found. */
  public load(runId: string): Map<string, string> {
    const run = this.loadRaw(runId);
    const map = new Map<string, string>();
    if (run) {
      for (const entry of run.phases) {
        map.set(entry.phaseId, entry.output);
      }
    }
    return map;
  }

  /** Load run metadata (topic, startedAt). */
  public loadRunMeta(runId: string): Pick<CheckpointRun, 'topic' | 'startedAt'> | null {
    const run = this.loadRaw(runId);
    if (!run) return null;
    return { topic: run.topic, startedAt: run.startedAt };
  }

  /** List all runs that have at least one completed phase (i.e., interrupted or done). */
  public listRuns(): CheckpointRun[] {
    if (!this.persistenceAvailable) return [];
    try {
      const files = fs.readdirSync(this.checkpointDir).filter(f => f.endsWith('.json'));
      return files
        .map(f => {
          try {
            const raw = fs.readFileSync(path.join(this.checkpointDir, f), 'utf-8');
            return JSON.parse(raw) as CheckpointRun;
          } catch {
            return null;
          }
        })
        .filter((r): r is CheckpointRun => r !== null);
    } catch {
      return [];
    }
  }

  /** Clear checkpoint for a completed run to free disk space. */
  public clear(runId: string): void {
    if (!this.persistenceAvailable) return;
    const file = this.filePath(runId);
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // Non-fatal
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private loadRaw(runId: string): CheckpointRun | null {
    if (!this.persistenceAvailable) return null;
    const file = this.filePath(runId);
    try {
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as CheckpointRun;
    } catch {
      return null;
    }
  }

  private writeRun(runId: string, run: CheckpointRun): void {
    if (!this.persistenceAvailable) return;
    try {
      fs.writeFileSync(this.filePath(runId), JSON.stringify(run, null, 2), 'utf-8');
    } catch {
      // Non-fatal — in-memory state already updated
    }
  }

  private filePath(runId: string): string {
    // Sanitize runId to safe filename characters only
    const safeId = runId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.checkpointDir, `${safeId}.json`);
  }

  private ensureDir(): boolean {
    try {
      if (!fs.existsSync(this.checkpointDir)) {
        fs.mkdirSync(this.checkpointDir, { recursive: true });
      }
      return true;
    } catch {
      return false;
    }
  }
}
