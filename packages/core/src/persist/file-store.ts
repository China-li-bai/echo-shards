/**
 * Optional Node file-backed store under `.data/` (gitignored).
 * Used by CLI demos so AgentEventLog / progress snapshots survive across runs.
 * Browser keeps localStorage; this module must not be imported from client components.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { EventLogSnapshot } from "../agents/event-log.js";
import type { CampProgress } from "../agents/progress.js";
import { progressFromEvents, emptyCampProgress } from "../agents/progress.js";

export const DEFAULT_DATA_DIR = ".data";

export interface FileStoreOptions {
  /** Absolute or repo-relative path. Default: `<repo>/.data` */
  dataDir: string;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function resolveDataDir(repoRoot: string, relative = DEFAULT_DATA_DIR): string {
  return join(repoRoot, relative);
}

export class FileEventStore {
  readonly dataDir: string;

  constructor(options: FileStoreOptions) {
    this.dataDir = options.dataDir;
    ensureDir(this.dataDir);
  }

  private pathFor(name: string): string {
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return join(this.dataDir, `${safe}.json`);
  }

  writeSnapshot(name: string, snapshot: EventLogSnapshot): string {
    const path = this.pathFor(name);
    const payload = {
      written_at: new Date().toISOString(),
      snapshot,
    };
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return path;
  }

  /** Append-friendly: merge incoming events/runs into an existing snapshot. */
  appendSnapshot(name: string, incoming: EventLogSnapshot): string {
    const existing = this.loadSnapshot(name);
    const merged: EventLogSnapshot = existing
      ? {
          runs: [...existing.runs, ...incoming.runs],
          proposals: [...existing.proposals, ...incoming.proposals],
          events: [...existing.events, ...incoming.events],
          eval_scores: [...existing.eval_scores, ...incoming.eval_scores],
        }
      : incoming;
    return this.writeSnapshot(name, merged);
  }

  loadSnapshot(name: string): EventLogSnapshot | null {
    const path = this.pathFor(name);
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      snapshot?: EventLogSnapshot;
    } & EventLogSnapshot;
    if (raw.snapshot) return raw.snapshot;
    if (Array.isArray(raw.events)) {
      return {
        runs: raw.runs ?? [],
        proposals: raw.proposals ?? [],
        events: raw.events,
        eval_scores: raw.eval_scores ?? [],
      };
    }
    return null;
  }

  writeProgress(progress: CampProgress): string {
    const path = join(this.dataDir, "progress.json");
    writeFileSync(
      path,
      `${JSON.stringify({ ...progress, updated_at: progress.updated_at.toISOString?.() ?? progress.updated_at }, null, 2)}\n`,
      "utf8",
    );
    return path;
  }

  loadProgress(): CampProgress | null {
    const path = join(this.dataDir, "progress.json");
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8")) as CampProgress & {
      updated_at: string;
    };
    return {
      ...raw,
      updated_at: new Date(raw.updated_at),
      source: "events",
    };
  }

  /**
   * Recompute progress from the named event snapshot (or empty).
   * Writes `progress.json` as a side effect.
   */
  syncProgressFrom(name: string, userId = "local-learner"): CampProgress {
    const snap = this.loadSnapshot(name);
    const progress = snap
      ? progressFromEvents({
          user_id: userId,
          events: snap.events,
          eval_scores: snap.eval_scores,
        })
      : emptyCampProgress(userId);
    this.writeProgress(progress);
    return progress;
  }

  listFiles(): string[] {
    if (!existsSync(this.dataDir)) return [];
    return readdirSync(this.dataDir).filter((name) => name.endsWith(".json"));
  }
}
