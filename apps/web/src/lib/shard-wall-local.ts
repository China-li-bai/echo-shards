/**
 * Browser form-shard wall from localStorage learning events + tide round cards.
 * Derived view only — never invents「已掌握」status.
 */

import {
  deriveShardWall,
  emptyShardWall,
  type DueSoonCardHint,
  type EventLogSnapshot,
  type ShardWallView,
} from "@echo-shards/core";
import {
  DAY_PLAN_STORAGE_KEY,
  QUEST_LOG_STORAGE_KEY,
  ROUND_STORAGE_PREFIX,
  mergeEventLogSnapshots,
} from "./camp-progress-local";

export type LexemeLabelMap = ReadonlyMap<string, string> | Record<string, string>;

export interface ShardWallLocalOptions {
  now?: Date;
  /** quest_id → target lexeme ids (catalog fallback for older deals). */
  questTargetsById?: ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;
}

function isEventLogSnapshot(value: unknown): value is EventLogSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.events) && Array.isArray(row.eval_scores);
}

function readSnapshots(storage: Storage): EventLogSnapshot[] {
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
    /* ignore */
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
      /* ignore */
    }
  }

  try {
    const questRaw = storage.getItem(QUEST_LOG_STORAGE_KEY);
    if (questRaw) {
      const parsed = JSON.parse(questRaw) as { version?: number; event_log?: unknown };
      if (parsed.version === 1 && isEventLogSnapshot(parsed.event_log)) {
        out.push(parsed.event_log);
      }
    }
  } catch {
    /* ignore */
  }

  return out;
}

/** Pull form-aspect due hints from review round Tide snapshots (far shore only). */
export function readDueSoonHintsFromStorage(storage: Storage): DueSoonCardHint[] {
  const hints: DueSoonCardHint[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith(ROUND_STORAGE_PREFIX)) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const saved = JSON.parse(raw) as {
        version?: number;
        tide?: { cards?: unknown[] };
      };
      if (saved.version !== 2 || !Array.isArray(saved.tide?.cards)) continue;
      for (const row of saved.tide.cards) {
        if (!row || typeof row !== "object") continue;
        const card = row as {
          lexeme_id?: unknown;
          aspect?: unknown;
          review?: { due?: unknown };
        };
        if (typeof card.lexeme_id !== "string") continue;
        if (card.aspect !== "form" && card.aspect !== "meaning" && card.aspect !== "phonology_text") {
          continue;
        }
        const due = card.review?.due;
        if (due == null) continue;
        hints.push({
          lexeme_id: card.lexeme_id,
          aspect: card.aspect,
          due: typeof due === "string" || due instanceof Date ? due : String(due),
        });
      }
    } catch {
      /* ignore corrupt round */
    }
  }
  return hints;
}

export function shardWallFromSnapshots(
  snapshots: readonly EventLogSnapshot[],
  dueCards: readonly DueSoonCardHint[] = [],
  options: ShardWallLocalOptions = {},
): ShardWallView {
  const now = options.now ?? new Date();
  const { events } = mergeEventLogSnapshots(snapshots);
  if (events.length === 0 && dueCards.length === 0) {
    return emptyShardWall(now, "form");
  }
  return deriveShardWall({
    events,
    now,
    aspect: "form",
    quest_targets_by_id: options.questTargetsById,
    due_cards: dueCards,
  });
}

/**
 * Derive form shard wall from day-plan + review + quest localStorage.
 * Call only in the browser.
 */
export function getShardWallFromLocalStorage(
  options: ShardWallLocalOptions = {},
): ShardWallView {
  const now = options.now ?? new Date();
  if (typeof localStorage === "undefined") {
    return emptyShardWall(now, "form");
  }
  const snapshots = readSnapshots(localStorage);
  const dueCards = readDueSoonHintsFromStorage(localStorage);
  return shardWallFromSnapshots(snapshots, dueCards, { ...options, now });
}

export function resolveLexemeLabel(lexemeId: string, labels?: LexemeLabelMap): string {
  if (!labels) return lexemeId.replace(/^en_/, "");
  if (labels instanceof Map) {
    return labels.get(lexemeId) ?? lexemeId.replace(/^en_/, "");
  }
  const record = labels as Record<string, string>;
  return record[lexemeId] ?? lexemeId.replace(/^en_/, "");
}
