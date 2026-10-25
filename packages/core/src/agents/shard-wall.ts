/**
 * Form-realm shard wall — derived view only (no persisted「掌握」state).
 * Lighting: Good/Easy on ≥2 distinct Asia/Shanghai calendar days from retrieval_grade.
 * Seals: quest_success linked to lexeme ids (payload or quest catalog fallback).
 * Far shore: due-soon horizon metaphor (not a second table).
 */

import { dayIdShanghai } from "../format.js";
import type { Aspect } from "../models/types.js";
import { parseCardId } from "../scheduler/TideScheduler.js";
import type { LearningEventRecord } from "./event-log.js";

/** Good / Easy — successful retrieval grades (not Again/Hard). */
export const SUCCESS_GRADES = new Set([3, 4]);

export interface ShardSuccessDay {
  day_id: string;
  grade: number;
  at: string;
}

export interface ShardLitView {
  lexeme_id: string;
  aspect: Aspect;
  /** Cross-day successful retrieval ≥2. */
  lit: boolean;
  /** Threshold first crossed on today's Shanghai calendar day. */
  newly_lit_today: boolean;
  /** Distinct Shanghai days with ≥1 Good/Easy, sorted ascending. */
  successful_days: string[];
  /** Chronological successful retrieval samples (one per day kept = best/latest). */
  success_samples: ShardSuccessDay[];
  last_success_at?: string;
  deal_count: number;
  has_seal: boolean;
  /**
   * Deal exists but shard not yet lit — rare「淡砖+印」.
   * Dual tracks never merge into one mastery badge.
   */
  faint_with_seal: boolean;
}

export interface FarShoreView {
  /** Unique form-aspect lexemes with due within the near horizon. */
  due_soon_count: number;
  visible: boolean;
}

export interface ShardWallView {
  aspect: Aspect;
  shards: ShardLitView[];
  far_shore: FarShoreView;
  lit_count: number;
  newly_lit_today_count: number;
  seal_count: number;
  /** No lit shards and no faint seal bricks — pure invite. */
  cold: boolean;
  today_id: string;
}

export interface DueSoonCardHint {
  lexeme_id: string;
  aspect: Aspect;
  /** ISO or Date-parseable due. */
  due: string | Date;
}

export interface ShardWallInput {
  events: readonly LearningEventRecord[];
  now?: Date;
  /** Wall focuses one aspect (camp home = form). */
  aspect?: Aspect;
  /**
   * Optional quest_id → target lexeme ids for older quest_success events
   * that lack payload.target_lexemes.
   */
  quest_targets_by_id?: ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;
  /** Form cards from local Tide snapshots — far shore only. */
  due_cards?: readonly DueSoonCardHint[];
  /** Hours ahead for「将至」horizon (default 72). Includes overdue. */
  due_soon_horizon_hours?: number;
}

function asQuestTargetMap(
  input: ShardWallInput["quest_targets_by_id"],
): Map<string, readonly string[]> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  return new Map(Object.entries(input));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is string => typeof row === "string" && row.length > 0);
}

/** Lexeme ids linked to a quest_success event (payload first, then catalog fallback). */
export function lexemeIdsFromQuestSuccess(
  event: LearningEventRecord,
  questTargetsById?: ReadonlyMap<string, readonly string[]>,
): string[] {
  if (event.event_type !== "quest_success") return [];
  const payload = event.payload ?? {};
  const fromPayload = stringArray(payload.lexeme_ids).length
    ? stringArray(payload.lexeme_ids)
    : stringArray(payload.target_lexemes);
  if (fromPayload.length > 0) return [...new Set(fromPayload)];
  const questId = payload.quest_id;
  if (typeof questId === "string" && questTargetsById?.has(questId)) {
    return [...new Set(questTargetsById.get(questId) ?? [])];
  }
  return [];
}

function isSuccessfulRetrieval(
  event: LearningEventRecord,
  aspect: Aspect,
): { lexemeId: string; grade: number; at: string; day: string } | null {
  if (event.event_type !== "retrieval_grade") return null;
  const grade = Number(event.payload?.grade ?? 0);
  if (!SUCCESS_GRADES.has(grade)) return null;
  const parsed = event.card_id ? parseCardId(event.card_id) : null;
  const payloadLexeme =
    typeof event.payload?.lexeme_id === "string" ? event.payload.lexeme_id : null;
  const payloadAspect = event.payload?.aspect;
  const lexemeId = parsed?.lexemeId ?? payloadLexeme;
  const eventAspect = parsed?.aspect ?? (payloadAspect as Aspect | undefined);
  if (!lexemeId || eventAspect !== aspect) return null;
  return {
    lexemeId,
    grade,
    at: event.created_at,
    day: dayIdShanghai(new Date(event.created_at)),
  };
}

/**
 * Derive form (or other aspect) shard wall from learning events + optional due hints.
 * Prefer this over any persisted「mastered」flag.
 */
export function deriveShardWall(input: ShardWallInput): ShardWallView {
  const now = input.now ?? new Date();
  const aspect: Aspect = input.aspect ?? "form";
  const today = dayIdShanghai(now);
  const questMap = asQuestTargetMap(input.quest_targets_by_id);
  const horizonHours = input.due_soon_horizon_hours ?? 72;
  const horizonMs = horizonHours * 60 * 60 * 1000;

  // lexeme → day_id → best sample (latest at, prefer Easy over Good on same day)
  const byLexeme = new Map<string, Map<string, ShardSuccessDay>>();

  for (const event of input.events) {
    const hit = isSuccessfulRetrieval(event, aspect);
    if (!hit) continue;
    let days = byLexeme.get(hit.lexemeId);
    if (!days) {
      days = new Map();
      byLexeme.set(hit.lexemeId, days);
    }
    const prev = days.get(hit.day);
    if (
      !prev ||
      hit.grade > prev.grade ||
      (hit.grade === prev.grade && hit.at > prev.at)
    ) {
      days.set(hit.day, { day_id: hit.day, grade: hit.grade, at: hit.at });
    }
  }

  const dealCounts = new Map<string, number>();
  for (const event of input.events) {
    if (event.event_type !== "quest_success") continue;
    for (const lexemeId of lexemeIdsFromQuestSuccess(event, questMap)) {
      dealCounts.set(lexemeId, (dealCounts.get(lexemeId) ?? 0) + 1);
    }
  }

  const lexemeIds = new Set<string>([...byLexeme.keys(), ...dealCounts.keys()]);
  const shards: ShardLitView[] = [];

  for (const lexemeId of lexemeIds) {
    const dayMap = byLexeme.get(lexemeId) ?? new Map();
    const samples = [...dayMap.values()].sort((a, b) =>
      a.day_id < b.day_id ? -1 : a.day_id > b.day_id ? 1 : 0,
    );
    const successful_days = samples.map((s) => s.day_id);
    const lit = successful_days.length >= 2;
    // First day that crossed the ≥2 threshold
    const crossingDay = lit ? successful_days[1]! : undefined;
    const newly_lit_today = crossingDay === today;
    const deal_count = dealCounts.get(lexemeId) ?? 0;
    const has_seal = deal_count > 0;
    const faint_with_seal = has_seal && !lit;
    const last = samples.length > 0 ? samples[samples.length - 1] : undefined;

    // Show on wall only if lit OR rare faint seal brick
    if (!lit && !faint_with_seal) continue;

    shards.push({
      lexeme_id: lexemeId,
      aspect,
      lit,
      newly_lit_today,
      successful_days,
      success_samples: samples,
      last_success_at: last?.at,
      deal_count,
      has_seal,
      faint_with_seal,
    });
  }

  // Lit first (new-today ahead), then faint seals; stable by lexeme_id
  shards.sort((a, b) => {
    if (a.lit !== b.lit) return a.lit ? -1 : 1;
    if (a.newly_lit_today !== b.newly_lit_today) return a.newly_lit_today ? -1 : 1;
    return a.lexeme_id.localeCompare(b.lexeme_id);
  });

  const dueSoon = new Set<string>();
  const nowMs = now.getTime();
  for (const card of input.due_cards ?? []) {
    if (card.aspect !== aspect) continue;
    const dueMs = new Date(card.due).getTime();
    if (!Number.isFinite(dueMs)) continue;
    // Overdue or due within horizon
    if (dueMs <= nowMs + horizonMs) {
      dueSoon.add(card.lexeme_id);
    }
  }

  const lit_count = shards.filter((s) => s.lit).length;
  const newly_lit_today_count = shards.filter((s) => s.newly_lit_today).length;
  const seal_count = shards.filter((s) => s.has_seal).length;
  const cold = shards.length === 0;

  return {
    aspect,
    shards,
    far_shore: {
      due_soon_count: dueSoon.size,
      visible: dueSoon.size > 0,
    },
    lit_count,
    newly_lit_today_count,
    seal_count,
    cold,
    today_id: today,
  };
}

/** Empty wall placeholder (SSR / loading). */
export function emptyShardWall(
  now: Date = new Date(),
  aspect: Aspect = "form",
): ShardWallView {
  return {
    aspect,
    shards: [],
    far_shore: { due_soon_count: 0, visible: false },
    lit_count: 0,
    newly_lit_today_count: 0,
    seal_count: 0,
    cold: true,
    today_id: dayIdShanghai(now),
  };
}
