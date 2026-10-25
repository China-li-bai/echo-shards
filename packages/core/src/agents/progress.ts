/**
 * Derive camp progress (xp / shards / streak) from learning_events + eval_scores.
 * Aligns with progress fields in 001_text_foundation.sql. No Supabase required.
 */

import { dayIdShanghai } from "../format.js";
import type { Progress } from "../models/types.js";
import type { EvalScoreRecord, LearningEventRecord } from "./event-log.js";

export interface ProgressInput {
  user_id?: string;
  events: readonly LearningEventRecord[];
  eval_scores?: readonly EvalScoreRecord[];
  now?: Date;
}

export interface CampProgress extends Progress {
  session_count: number;
  retrieval_count: number;
  quest_success_count: number;
  breach_count: number;
  source: "events";
}

function dayFromIso(iso: string): string {
  return dayIdShanghai(new Date(iso));
}

/** Consecutive Asia/Shanghai study days ending at `now` (inclusive if activity today). */
export function streakDaysFromEvents(
  events: readonly LearningEventRecord[],
  now: Date = new Date(),
): number {
  const days = new Set<string>();
  for (const event of events) {
    if (
      event.event_type === "session_end" ||
      event.event_type === "retrieval_grade" ||
      event.event_type === "quest_success" ||
      event.event_type === "proposal_accepted"
    ) {
      days.add(dayFromIso(event.created_at));
    }
  }
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date(now);
  for (;;) {
    const id = dayIdShanghai(cursor);
    if (!days.has(id)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function progressFromEvents(input: ProgressInput): CampProgress {
  const events = input.events;
  const evalScores = input.eval_scores ?? [];
  const now = input.now ?? new Date();

  const session_count = events.filter((e) => e.event_type === "session_end").length;
  const retrieval_count = events.filter((e) => e.event_type === "retrieval_grade").length;
  const quest_success_count = events.filter((e) => e.event_type === "quest_success").length;
  const breach_count =
    events.filter((e) => e.event_type === "policy_breach").length +
    evalScores.reduce((sum, row) => sum + row.breach_flags.length, 0);

  const gradeXp = events
    .filter((e) => e.event_type === "retrieval_grade")
    .reduce((sum, e) => {
      const grade = Number(e.payload.grade ?? 0);
      return sum + (Number.isFinite(grade) ? grade * 10 : 10);
    }, 0);
  const xp = gradeXp + quest_success_count * 50 + session_count * 5;
  const shards = quest_success_count + Math.floor(retrieval_count / 5);
  const streak_days = streakDaysFromEvents(events, now);
  const camp_level = Math.max(1, 1 + Math.floor(xp / 200));

  return {
    user_id: input.user_id ?? "local-learner",
    xp,
    shards,
    camp_level,
    streak_days,
    updated_at: now,
    session_count,
    retrieval_count,
    quest_success_count,
    breach_count,
    source: "events",
  };
}

/** Empty camp placeholder when no event log is available yet. */
export function emptyCampProgress(userId = "local-learner", now = new Date()): CampProgress {
  return {
    user_id: userId,
    xp: 0,
    shards: 0,
    camp_level: 1,
    streak_days: 0,
    updated_at: now,
    session_count: 0,
    retrieval_count: 0,
    quest_success_count: 0,
    breach_count: 0,
    source: "events",
  };
}
