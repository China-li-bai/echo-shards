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

export class SchedulePolicyError extends Error {
  readonly breach = "schedule_write" as const;

  constructor(message: string) {
    super(message);
    this.name = "SchedulePolicyError";
  }
}

export function assertNoScheduleFields(payload: unknown, agent: string): void {
  if (!payload || typeof payload !== "object") return;
  const rec = payload as Record<string, unknown>;
  const hit = SCHEDULE_FIELDS.filter((key) =>
    Object.prototype.hasOwnProperty.call(rec, key),
  );
  if (hit.length > 0) {
    throw new SchedulePolicyError(
      `${agent} tried to set schedule field(s) ${hit.join(", ")}. Grades go through TideScheduler.rate; due stays deterministic.`,
    );
  }
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
