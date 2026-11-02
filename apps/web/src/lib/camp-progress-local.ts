/**
 * Browser camp progress from localStorage AgentEventLog snapshots.
 * Workers have no server .data/ ledger — honesty requires client-side derivation.
 */

import {
  emptyCampProgress,
  progressFromEvents,
  type CampProgress,
  type EvalScoreRecord,
  type EventLogSnapshot,
  type LearningEventRecord,
} from "@echo-shards/core";

/** Same key as day-desk AcceptedDayPlan persistence. */
export const DAY_PLAN_STORAGE_KEY = "echo-shards.day-plan.v1";

/** Prefix for review-session SavedRound keys (`echo-shards.round.v2:${pool}:${aspect}`). */
export const ROUND_STORAGE_PREFIX = "echo-shards.round.v2:";

/** Persisted Echo Broker / quest-desk event log (deal → camp ledger). */
export const QUEST_LOG_STORAGE_KEY = "echo-shards.quest-log.v1";

export interface CampProgressView {
  progress: CampProgress;
  eventCount: number;
  /** Short UI copy; never pretends to be a Workers server ledger. */
  sourceLabel: string;
}

function isEventLogSnapshot(value: unknown): value is EventLogSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.events) && Array.isArray(row.eval_scores);
}

function isLearningEvent(value: unknown): value is LearningEventRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.event_type === "string" && typeof row.created_at === "string";
}

function isEvalScore(value: unknown): value is EvalScoreRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && Array.isArray(row.breach_flags);
}

/** Merge snapshots; prefer first-seen id (stable across day-plan → review restore copies). */
export function mergeEventLogSnapshots(
  snapshots: readonly EventLogSnapshot[],
): { events: LearningEventRecord[]; eval_scores: EvalScoreRecord[] } {
  const eventsById = new Map<string, LearningEventRecord>();
  const evalById = new Map<string, EvalScoreRecord>();
  for (const snap of snapshots) {
    for (const event of snap.events) {
      if (!isLearningEvent(event)) continue;
      if (!eventsById.has(event.id)) eventsById.set(event.id, event);
    }
    for (const score of snap.eval_scores) {
      if (!isEvalScore(score)) continue;
      if (!evalById.has(score.id)) evalById.set(score.id, score);
    }
  }
  return {
    events: [...eventsById.values()],
    eval_scores: [...evalById.values()],
  };
}

export function campProgressFromSnapshots(
  snapshots: readonly EventLogSnapshot[],
  now: Date = new Date(),
): CampProgressView {
  const { events, eval_scores } = mergeEventLogSnapshots(snapshots);
  if (events.length === 0 && eval_scores.length === 0) {
    return {
      progress: emptyCampProgress("local-learner", now),
      eventCount: 0,
      sourceLabel: "还没有练习记录",
    };
  }
  return {
    progress: progressFromEvents({ events, eval_scores, now, user_id: "local-learner" }),
    eventCount: events.length,
    sourceLabel: "来自你的练习",
  };
}

function readQuestLogSnapshot(storage: Storage): EventLogSnapshot | null {
  try {
    const raw = storage.getItem(QUEST_LOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; event_log?: unknown };
    if (parsed.version === 1 && isEventLogSnapshot(parsed.event_log)) {
      return parsed.event_log;
    }
  } catch {
    /* ignore corrupt quest log */
  }
  return null;
}

/**
 * Merge a quest-desk AgentEventLog snapshot into persistent camp ledger storage.
 * Idempotent by event id — refresh / re-append of the same snapshot does not double-count.
 */
export function appendQuestEventLogSnapshot(snapshot: EventLogSnapshot): void {
  if (typeof localStorage === "undefined") return;
  const existing = readQuestLogSnapshot(localStorage) ?? {
    runs: [],
    proposals: [],
    events: [],
    eval_scores: [],
  };
  const merged = mergeEventLogSnapshots([existing, snapshot]);
  const next: EventLogSnapshot = {
    runs: existing.runs,
    proposals: existing.proposals,
    events: merged.events,
    eval_scores: merged.eval_scores,
  };
  localStorage.setItem(
    QUEST_LOG_STORAGE_KEY,
    JSON.stringify({ version: 1, event_log: next }),
  );
}

function readSnapshotsFromStorage(storage: Storage): EventLogSnapshot[] {
  const out: EventLogSnapshot[] = [];

  try {
    const dayRaw = storage.getItem(DAY_PLAN_STORAGE_KEY);
    if (dayRaw) {
      const plan = JSON.parse(dayRaw) as { version?: number; event_log?: unknown };
      if (plan.version === 1 && isEventLogSnapshot(plan.event_log)) {
        out.push(plan.event_log);
      }
    }
  } catch {
    /* ignore corrupt day plan */
  }

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith(ROUND_STORAGE_PREFIX)) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const saved = JSON.parse(raw) as { version?: number; log?: unknown };
      if (saved.version === 2 && isEventLogSnapshot(saved.log)) {
        out.push(saved.log);
      }
    } catch {
      /* ignore corrupt round */
    }
  }

  const questSnap = readQuestLogSnapshot(storage);
  if (questSnap) out.push(questSnap);

  return out;
}

/**
 * Derive camp streak/XP/shards from day-plan + review + quest localStorage snapshots.
 * Call only in the browser (client components / effects).
 */
export function getCampProgressFromLocalStorage(now: Date = new Date()): CampProgressView {
  if (typeof localStorage === "undefined") {
    return {
      progress: emptyCampProgress("local-learner", now),
      eventCount: 0,
      sourceLabel: "还没有练习记录",
    };
  }
  return campProgressFromSnapshots(readSnapshotsFromStorage(localStorage), now);
}
