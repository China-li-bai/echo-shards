/**
 * Eval Sentinel — records scores and policy breaches.
 * A blocked schedule write is a pass for the guard, not a product success.
 */

import type { Grade, Lexeme } from "../models/types.js";
import { TideScheduler } from "../scheduler/TideScheduler.js";
import { AgentEventLog } from "./event-log.js";
import { assertNoScheduleFields, SchedulePolicyError } from "./policy.js";

export class EvalSentinel {
  constructor(private readonly log: AgentEventLog) {}

  flagPolicyBreach(agent: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.log.recordRun({
      agent: "eval_sentinel",
      tools: ["flagPolicyBreach"],
      status: "ok",
      input_ref: agent,
    });
    this.log.recordEval({
      suite: "policy",
      item_id: agent,
      metric: "schedule_write_blocked",
      score: 1,
      breach_flags: [message],
    });
    this.log.recordEvent({
      event_type: "policy_breach",
      payload: { agent, message },
    });
  }

  scoreRetrieval(grade: Grade): void {
    this.log.recordRun({
      agent: "eval_sentinel",
      tools: ["scoreDealRate"],
      status: "ok",
      output_ref: `grade=${grade}`,
    });
    this.log.recordEval({
      suite: "form-round",
      metric: "grade_normalized",
      score: (grade - 1) / 3,
      breach_flags: [],
    });
  }

  /**
   * Deterministic gold checks: schedule writes throw, rate() moves the card,
   * and a second aspect stays on its own card.
   */
  runGoldSuite(lexeme: Lexeme): string[] {
    const failures: string[] = [];
    try {
      assertNoScheduleFields({ due: "2099-01-01T00:00:00.000Z", grade: 3 }, "gold");
      failures.push("expected a schedule write to throw");
    } catch (error) {
      if (!(error instanceof SchedulePolicyError)) {
        failures.push(`expected SchedulePolicyError, got ${String(error)}`);
      } else {
        this.flagPolicyBreach("gold", error);
      }
    }

    const tide = new TideScheduler({ requestRetention: 0.9 });
    const now = new Date("2026-10-25T00:00:00.000Z");
    const form = tide.enqueueNew("gold-user", lexeme, "form", now);
    const rated = tide.rate(form.id, 3, new Date("2026-10-25T00:05:00.000Z"));
    if (!(rated.card.review.due instanceof Date)) failures.push("due is not a Date");
    if (rated.card.review.reps < 1) failures.push("reps did not advance");
    if (rated.log.grade !== 3) failures.push("review log lost the grade");

    const meaning = tide.enqueueNew("gold-user", lexeme, "meaning", now);
    if (meaning.id === form.id) failures.push("form and meaning share a card id");
    if (meaning.review.reps !== 0) failures.push("meaning card was graded by the form rate");

    const batch = tide.buildSessionBatch(
      "gold-user",
      "form",
      5,
      new Date("2026-10-25T00:05:00.000Z"),
    );
    if (batch.aspect !== "form") failures.push("batch aspect drifted");
    if (batch.lexeme_ids.length > 5) failures.push("batch exceeded 5");

    this.log.recordRun({
      agent: "eval_sentinel",
      tools: ["runGoldSuite"],
      status: failures.length === 0 ? "ok" : "error",
      error_message: failures.join("; ") || undefined,
    });
    this.log.recordEval({
      suite: "gold",
      metric: "pass",
      score: failures.length === 0 ? 1 : 0,
      breach_flags: failures,
    });
    return failures;
  }
}
