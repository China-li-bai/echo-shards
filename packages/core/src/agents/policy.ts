/**
 * Schedule fields belong to ts-fsrs via TideScheduler.rate.
 * Agent payloads that carry them are a policy breach, not a suggestion.
 */

const SCHEDULE_FIELDS = [
  "due",
  "stability",
  "difficulty",
  "scheduled_days",
  "elapsed_days",
  "learning_steps",
  "lapses",
  "reps",
  "state",
  "last_review",
] as const;

const SCHEDULE_FIELD_SET: ReadonlySet<string> = new Set(SCHEDULE_FIELDS);

/** Cap nested walks so a malicious mega-object cannot DoS the guard. */
const MAX_SCHEDULE_SCAN_DEPTH = 8;

export class SchedulePolicyError extends Error {
  readonly breach = "schedule_write" as const;

  constructor(message: string) {
    super(message);
    this.name = "SchedulePolicyError";
  }
}

/**
 * Reject payloads that carry FSRS schedule fields at any depth
 * (e.g. `{ due }`, `{ card: { due } }`, `{ review: { stability } }`).
 * Arrays are walked; depth stops at MAX_SCHEDULE_SCAN_DEPTH.
 */
export function assertNoScheduleFields(payload: unknown, agent: string): void {
  const hit = collectScheduleHits(payload, 0, "");
  if (hit.length === 0) return;
  throw new SchedulePolicyError(
    `${agent} tried to set schedule field(s) ${[...new Set(hit)].join(", ")}. Grades go through TideScheduler.rate; due stays deterministic.`,
  );
}

function collectScheduleHits(value: unknown, depth: number, path: string): string[] {
  if (depth > MAX_SCHEDULE_SCAN_DEPTH) return [];
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    const hits: string[] = [];
    for (let i = 0; i < value.length; i++) {
      hits.push(...collectScheduleHits(value[i], depth + 1, path ? `${path}[${i}]` : `[${i}]`));
    }
    return hits;
  }

  const rec = value as Record<string, unknown>;
  const hits: string[] = [];
  for (const key of Object.keys(rec)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (SCHEDULE_FIELD_SET.has(key)) {
      hits.push(nextPath);
      continue;
    }
    hits.push(...collectScheduleHits(rec[key], depth + 1, nextPath));
  }
  return hits;
}

/** TOPRA: one aspect per session batch. */
export function assertSingleAspect(aspects: readonly string[]): void {
  const unique = [...new Set(aspects)];
  if (unique.length !== 1) {
    throw new SchedulePolicyError(
      `TOPRA: a session batch locks one aspect, got ${unique.join(", ") || "(none)"}.`,
    );
  }
}
