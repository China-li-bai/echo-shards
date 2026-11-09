/**
 * Read a saved review round and, when the logs predate client_event_id,
 * fill a stable id. This does not call TideScheduler.rate and does not
 * change grade, time, or card schedule fields.
 *
 * The original storage value is replaced only after the caller validates the
 * migrated round and setItem succeeds. A failed read or a failed write leaves
 * the previous text in place. There is no second backup key, so 清空练习记录
 * still removes the one round key and nothing else is added under echo-shards.
 *
 * E2b still applies: a grade that was rated only in memory and never written
 * is gone after the page unloads. This module does not change that.
 */

export const ROUND_UNREADABLE_MESSAGE =
  "这台设备上有一份练习记录，这次还读不了。记录还在，没有删掉。";
export const ROUND_INVALID_MESSAGE =
  "这台设备上的练习记录对不上，这次先不打开。记录还在，没有删掉。";
export const ROUND_CONFLICT_MESSAGE =
  "这台设备上的练习记录有重复的一笔，这次先不打开。记录还在，没有删掉。";
export const ROUND_SAVE_FAILED_MESSAGE =
  "练习记录已经打开，这次没能更新存下来。原来的记录还在。";

const SUPPORTED_VERSION = 2;
const ID_MAX = 128;

export interface StoredRoundLog {
  card_id?: unknown;
  grade?: unknown;
  reviewed_at?: unknown;
  client_event_id?: unknown;
  [key: string]: unknown;
}

export interface StoredRound {
  version: 2;
  aspect?: unknown;
  lexemeIds?: unknown;
  tide: { cards: unknown[]; logs: StoredRoundLog[] };
  log?: unknown;
  index?: unknown;
  phase?: unknown;
  typed?: unknown;
  reveal?: unknown;
  why?: unknown;
  batchId?: unknown;
  lastDue?: unknown;
  questId?: unknown;
  [key: string]: unknown;
}

export type OpenStoredRoundResult =
  | { status: "empty" }
  | {
      status: "ready";
      round: StoredRound;
      migrated: boolean;
      saved: boolean;
      message?: string;
    }
  | { status: "held"; message: string };

export function deriveLegacyClientEventId(cardId: string, reviewedAtIso: string, grade: number): string {
  return `legacy:${encodeURIComponent(cardId)}:${reviewedAtIso}:${grade}`;
}

function canonicalInstant(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function held(message: string): { status: "held"; message: string } {
  return { status: "held", message };
}

function annotate(
  round: StoredRound,
): { status: "held"; message: string } | { status: "annotated"; round: StoredRound; migrated: boolean } {
  const logs = round.tide.logs.map((log) => ({ ...log }));
  const seen = new Set<string>();
  let migrated = false;
  for (const log of logs) {
    let id: string;
    if (log.client_event_id !== undefined && log.client_event_id !== null) {
      if (
        typeof log.client_event_id !== "string" ||
        log.client_event_id.length === 0 ||
        log.client_event_id.length > ID_MAX ||
        log.client_event_id !== log.client_event_id.trim()
      ) {
        return held(ROUND_INVALID_MESSAGE);
      }
      id = log.client_event_id;
    } else {
      if (typeof log.card_id !== "string" || log.card_id.length === 0) return held(ROUND_INVALID_MESSAGE);
      const iso = canonicalInstant(log.reviewed_at);
      if (!iso) return held(ROUND_INVALID_MESSAGE);
      if (log.grade !== 1 && log.grade !== 2 && log.grade !== 3 && log.grade !== 4) {
        return held(ROUND_INVALID_MESSAGE);
      }
      id = deriveLegacyClientEventId(log.card_id, iso, log.grade);
      log.client_event_id = id;
      migrated = true;
    }
    if (seen.has(id)) return held(ROUND_CONFLICT_MESSAGE);
    seen.add(id);
  }
  return {
    status: "annotated",
    migrated,
    round: {
      ...round,
      tide: {
        ...round.tide,
        cards: round.tide.cards,
        logs,
      },
    },
  };
}

export function openStoredRound(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  key: string,
  validate: (round: StoredRound) => void,
): OpenStoredRoundResult {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return held(ROUND_UNREADABLE_MESSAGE);
  }
  if (raw === null || raw === "") return { status: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return held(ROUND_UNREADABLE_MESSAGE);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return held(ROUND_INVALID_MESSAGE);
  const record = parsed as StoredRound;
  if (record.version !== SUPPORTED_VERSION) return held(ROUND_UNREADABLE_MESSAGE);
  if (!record.tide || !Array.isArray(record.tide.cards) || !Array.isArray(record.tide.logs)) {
    return held(ROUND_INVALID_MESSAGE);
  }
  const annotated = annotate(record);
  if (annotated.status === "held") return annotated;
  try {
    validate(annotated.round);
  } catch {
    return held(ROUND_INVALID_MESSAGE);
  }
  if (!annotated.migrated) {
    return { status: "ready", round: annotated.round, migrated: false, saved: true };
  }
  let text: string;
  try {
    text = JSON.stringify(annotated.round);
  } catch {
    return held(ROUND_INVALID_MESSAGE);
  }
  try {
    storage.setItem(key, text);
  } catch {
    return {
      status: "ready",
      round: annotated.round,
      migrated: true,
      saved: false,
      message: ROUND_SAVE_FAILED_MESSAGE,
    };
  }
  return { status: "ready", round: annotated.round, migrated: true, saved: true };
}
