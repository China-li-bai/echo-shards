/**
 * Tide Steward — may read the queue and send grades to TideScheduler.
 * Must not write due, stability, or scheduled_days itself.
 */

import type { Aspect, Grade, SessionBatch } from "../models/types.js";
import { ASPECT_LABEL } from "../format.js";
import { TideScheduler, type RateResult } from "../scheduler/TideScheduler.js";
import { AgentEventLog } from "./event-log.js";
import { assertNoScheduleFields, assertSingleAspect } from "./policy.js";

const BATCH_CAP = 5;

/** Learner-facing batch blurb. No due / queue / aspect / enqueue jargon. */
export function composeLearnerBatchWhy(aspect: Aspect, cardCount: number): string {
  const label = ASPECT_LABEL[aspect];
  const focus =
    aspect === "form" ? "拼词" : aspect === "meaning" ? "释义" : "文字音标";
  return `本轮只练「${label}」（${focus}）· 约 ${cardCount} 词。对照并确认后，会显示下次潮汐；这一潮先不碰其他界别。`;
}

/** Implementation detail for ?debug=1 — never the default learner path. */
export function composeBatchWhyDebug(aspect: Aspect, cardCount: number): string {
  return `本轮只开 ${aspect}。到期队列按 due 升序取 ${cardCount} 张（上限 ${BATCH_CAP}）。其他 aspect 即使已入队，也不进入这一批。`;
}

export class TideSteward {
  constructor(
    readonly tide: TideScheduler,
    private readonly log: AgentEventLog,
  ) {}

  enqueueIds(
    userId: string,
    lexemeIds: string[],
    aspect: Aspect,
    now: Date = new Date(),
  ) {
    assertSingleAspect([aspect]);
    const cards = lexemeIds.map((id) =>
      this.tide.enqueueNew(userId, { id }, aspect, now),
    );
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["enqueueAspect"],
      status: "ok",
      output_ref: `${aspect}:${cards.length}`,
    });
    return cards;
  }

  getDue(now: Date = new Date(), aspect?: Aspect, userId?: string) {
    const cards = this.tide
      .getDue(now, aspect)
      .filter((card) => (userId ? card.user_id === userId : true));
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["getDue"],
      status: "ok",
      input_ref: aspect ?? "all",
      output_ref: String(cards.length),
    });
    return cards;
  }

  buildSessionBatch(
    userId: string,
    aspect: Aspect,
    now: Date = new Date(),
  ): SessionBatch {
    assertSingleAspect([aspect]);
    const batch = this.tide.buildSessionBatch(userId, aspect, BATCH_CAP, now);
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["buildSessionBatch"],
      status: "ok",
      input_ref: aspect,
      output_ref: batch.id,
    });
    return batch;
  }

  /**
   * Learner-facing batch blurb. No due / queue / aspect / enqueue jargon.
   * Use explainWhyTheseCardsDebug for steward internals.
   */
  explainWhyTheseCards(batch: SessionBatch): string {
    const why = composeLearnerBatchWhy(batch.aspect, batch.card_ids.length);
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["explainWhyTheseCards"],
      status: "ok",
      output_ref: batch.id,
    });
    return why;
  }

  /** Implementation detail for ?debug=1 panels — not for default learner UI. */
  explainWhyTheseCardsDebug(batch: SessionBatch): string {
    return composeBatchWhyDebug(batch.aspect, batch.card_ids.length);
  }

  /**
   * The only schedule write. `grade` is 1–4. A payload that also carries
   * due/stability is rejected before ts-fsrs runs.
   */
  rate(
    cardId: string,
    grade: Grade,
    now: Date = new Date(),
    extra: Record<string, unknown> = {},
  ): RateResult {
    assertNoScheduleFields({ grade, ...extra }, "tide_steward");
    const result = this.tide.rate(cardId, grade, now);
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["rate"],
      status: "ok",
      input_ref: cardId,
      output_ref: `grade=${grade}`,
    });
    this.log.recordEvent({
      event_type: "retrieval_grade",
      card_id: cardId,
      payload: {
        grade,
        lexeme_id: result.card.lexeme_id,
        aspect: result.card.aspect,
        due: result.card.review.due.toISOString(),
        scheduled_days: result.card.review.scheduled_days,
        source: "TideScheduler.rate",
      },
    });
    return result;
  }
}
