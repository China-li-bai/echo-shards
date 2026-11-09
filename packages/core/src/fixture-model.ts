/**
 * Recorded JSON fixture for one optional comment on a meaning-use check.
 *
 * This is not a live model and it is not wired into the learner page.
 * Fixture text is data. It cannot change the basic check, rate a card,
 * or mark the meaning as judged. Callers pass a clock; nothing here sleeps
 * or contacts a network.
 */
import { checkMeaningUse, type MeaningUseResult } from "./meaning-use.js";

export const MEANING_USE_COMMENT_PROMPT_VERSION = "meaning-use-comment/v1";
const FIXTURE_LABEL = "test-fixture-not-learner-data";
const TASK = "meaning_use_comment";
const HARD_CAP = 2;
const COMMENT_MAX = 80;

const ALLOWED_KEYS = [
  "schema_version",
  "prompt_version",
  "task",
  "simulation",
  "fixture",
  "fixture_label",
  "lemma",
  "sentence",
  "comment",
] as const;

export interface FixtureCompletionSource {
  simulation: "recorded-json";
  open(): void;
  complete(request: { promptVersion: string; fixtureId?: string }): string;
  release(): void;
}

export interface FixtureMeaningCommentInput {
  lemma: string;
  sentence: string;
  forms?: readonly string[];
  enrichment_status?: string;
  promptVersion: string;
  source: FixtureCompletionSource;
  now: () => number;
  timeoutMs: number;
  maxAttempts?: number;
  signal?: { cancelled: boolean };
  fixtureId?: string;
}

export interface FixtureMeaningCommentResult {
  baseline: MeaningUseResult;
  model_judgment: "not_obtained" | "fixture_comment_only";
  fixture_comment: string | null;
  fallback_reason:
    | null
    | "invalid_json"
    | "schema"
    | "unauthorized_field"
    | "timeout"
    | "refused"
    | "error"
    | "cancelled"
    | "not_ready"
    | "baseline_not_pass"
    | "attempt_limit";
  attempts: number;
  prompt_version: typeof MEANING_USE_COMMENT_PROMPT_VERSION;
  simulation: "recorded-json";
}

function fallback(
  baseline: MeaningUseResult,
  reason: FixtureMeaningCommentResult["fallback_reason"],
  attempts: number,
): FixtureMeaningCommentResult {
  return {
    baseline,
    model_judgment: "not_obtained",
    fixture_comment: null,
    fallback_reason: reason,
    attempts,
    prompt_version: MEANING_USE_COMMENT_PROMPT_VERSION,
    simulation: "recorded-json",
  };
}

function validateFixture(
  raw: string,
  input: { lemma: string; sentence: string },
): { ok: true; comment: string } | { ok: false; reason: "invalid_json" | "schema" | "unauthorized_field" } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "schema" };
  }
  const record = parsed as Record<string, unknown>;
  const allowed = new Set<string>(ALLOWED_KEYS);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return { ok: false, reason: "unauthorized_field" };
  }
  if (record.schema_version !== 1) return { ok: false, reason: "schema" };
  if (record.prompt_version !== MEANING_USE_COMMENT_PROMPT_VERSION) return { ok: false, reason: "schema" };
  if (record.task !== TASK) return { ok: false, reason: "schema" };
  if (record.simulation !== "recorded-json") return { ok: false, reason: "schema" };
  if (record.fixture !== true) return { ok: false, reason: "schema" };
  if (record.fixture_label !== FIXTURE_LABEL) return { ok: false, reason: "schema" };
  if (record.lemma !== input.lemma || record.sentence !== input.sentence) {
    return { ok: false, reason: "schema" };
  }
  if (typeof record.comment !== "string" || record.comment.length < 1 || record.comment.length > COMMENT_MAX) {
    return { ok: false, reason: "schema" };
  }
  if (/学会|掌握|语义正确|会用了/.test(record.comment) || /\bdue\b|\brate\b/i.test(record.comment)) {
    return { ok: false, reason: "schema" };
  }
  return { ok: true, comment: record.comment };
}

/**
 * Ask a recorded fixture for an optional comment. The basic check is computed
 * first and is never replaced by the fixture.
 */
export function runFixtureMeaningComment(input: FixtureMeaningCommentInput): FixtureMeaningCommentResult {
  const baseline = checkMeaningUse({
    lemma: input.lemma,
    sentence: input.sentence,
    forms: input.forms,
    enrichment_status: input.enrichment_status,
  });
  if (baseline.verdict !== "basic_pass") {
    const reason = baseline.reasons.includes("not_ready") ? "not_ready" : "baseline_not_pass";
    return fallback(baseline, reason, 0);
  }
  if (input.promptVersion !== MEANING_USE_COMMENT_PROMPT_VERSION) {
    return fallback(baseline, "schema", 0);
  }
  if (input.source.simulation !== "recorded-json") {
    return fallback(baseline, "error", 0);
  }
  const allowed = Math.max(0, Math.min(HARD_CAP, input.maxAttempts ?? 1));
  if (input.signal?.cancelled) return fallback(baseline, "cancelled", 0);
  if (allowed === 0) return fallback(baseline, "attempt_limit", 0);

  let reason: FixtureMeaningCommentResult["fallback_reason"] = "error";
  let attempts = 0;
  for (let i = 0; i < allowed; i += 1) {
    let opened = false;
    try {
      input.source.open();
      opened = true;
      attempts += 1;
      if (input.signal?.cancelled) {
        reason = "cancelled";
        break;
      }
      const start = input.now();
      let raw = "";
      try {
        raw = input.source.complete({
          promptVersion: input.promptVersion,
          fixtureId: input.fixtureId,
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (name === "FixtureTimeout") reason = "timeout";
        else if (name === "FixtureRefusal") {
          reason = "refused";
          break;
        } else reason = "error";
        continue;
      }
      if (input.now() - start > input.timeoutMs) {
        reason = "timeout";
        continue;
      }
      const parsed = validateFixture(raw, { lemma: input.lemma, sentence: input.sentence });
      if (!parsed.ok) {
        reason = parsed.reason;
        break;
      }
      return {
        baseline,
        model_judgment: "fixture_comment_only",
        fixture_comment: parsed.comment,
        fallback_reason: null,
        attempts,
        prompt_version: MEANING_USE_COMMENT_PROMPT_VERSION,
        simulation: "recorded-json",
      };
    } finally {
      if (opened) input.source.release();
    }
  }
  return fallback(baseline, reason, attempts);
}
