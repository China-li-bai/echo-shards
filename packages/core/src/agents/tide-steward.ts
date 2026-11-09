/**
 * Tide Steward — may read the queue and send grades to TideScheduler.
 * Must not write due, stability, or scheduled_days itself.
 */

import type { Aspect, Grade, SessionBatch } from "../models/types.js";
import { ASPECT_LABEL } from "../format.js";
import {
  TideEventConflictError,
  TideScheduler,
  type RateResult,
} from "../scheduler/TideScheduler.js";
import { AgentEventLog } from "./event-log.js";
import { assertNoScheduleFields, assertSingleAspect } from "./policy.js";
import { assertMemoryRateExtra } from "../providers/pronunciation-boundary.js";
import {
  WORD_TIDE_COPY,
  filterDueByWordTideGate,
  type DueGateResult,
} from "./word-tide-gate.js";

const BATCH_CAP = 5;

function readClientEventId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new TideEventConflictError("client_event_id must be a string when provided.");
  }
  return value;
}

/** Learner-facing batch blurb. No due / queue / aspect / enqueue jargon. */
export function composeLearnerBatchWhy(aspect: Aspect, cardCount: number): string {
  const label = ASPECT_LABEL[aspect];
  return `这一轮只练「${label}」，大约 ${cardCount} 个词。对完你点个等级后，会告诉你改天再练的时间。`;
}

/** Implementation detail for ?debug=1 — never the default learner path. */
export function composeBatchWhyDebug(aspect: Aspect, cardCount: number): string {
  return `本轮只开 ${aspect}。到期队列按 due 升序取 ${cardCount} 张（上限 ${BATCH_CAP}）。其他 aspect 即使已入队，也不进入这一批。编排闸门可顺延撞车界（不改 due）。`;
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

  /**
   * 到期卡（可选经单词潮汐闸门：同日单界 + 解锁态）。
   * 闸门只过滤，不改 due。
   */
  getDue(
    now: Date = new Date(),
    aspect?: Aspect,
    userId?: string,
    options: { applyWordTideGate?: boolean } = {},
  ) {
    const applyGate = options.applyWordTideGate !== false;
    const allDue = this.tide
      .getDue(now)
      .filter((card) => (userId ? card.user_id === userId : true));
    let cards = allDue;
    if (applyGate) {
      const gated = filterDueByWordTideGate({
        dueCards: allDue,
        logs: this.tide.getLogs(),
        targetAspect: aspect,
        cards: this.tide.allCards(),
      });
      cards = gated.kept;
    } else if (aspect) {
      cards = allDue.filter((c) => c.aspect === aspect);
    }
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["getDue"],
      status: "ok",
      input_ref: aspect ?? "all",
      output_ref: String(cards.length),
    });
    return cards;
  }

  /** 闸门明细（演示 / assert / UI 旁注）。不改 due。 */
  gateDue(
    now: Date = new Date(),
    aspect?: Aspect,
    userId?: string,
  ): DueGateResult {
    const allDue = this.tide
      .getDue(now)
      .filter((card) => (userId ? card.user_id === userId : true));
    return filterDueByWordTideGate({
      dueCards: allDue,
      logs: this.tide.getLogs(),
      targetAspect: aspect,
      cards: this.tide.allCards(),
    });
  }

  buildSessionBatch(
    userId: string,
    aspect: Aspect,
    now: Date = new Date(),
    options: { applyWordTideGate?: boolean } = {},
  ): SessionBatch {
    assertSingleAspect([aspect]);
    const applyGate = options.applyWordTideGate !== false;
    let batch: SessionBatch;
    if (applyGate) {
      const gated = this.gateDue(now, aspect, userId);
      const picked = gated.kept.slice(0, BATCH_CAP);
      batch = {
        id: `batch_${userId}_${aspect}_${now.getTime()}`,
        user_id: userId,
        aspect,
        lexeme_ids: picked.map((c) => c.lexeme_id),
        card_ids: picked.map((c) => c.id),
        created_at: now,
      };
      if (gated.sameDayCollision || gated.deferred.some((c) => c.aspect === aspect)) {
        this.log.recordEvent({
          event_type: "intent",
          payload: {
            note: WORD_TIDE_COPY.sameDayDefer,
            deferred_card_ids: gated.deferred.map((c) => c.id),
            // 明确：编排顺延，不写 due
            due_unchanged: true,
          },
        });
      }
    } else {
      batch = this.tide.buildSessionBatch(userId, aspect, BATCH_CAP, now);
    }
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
   * client_event_id is an idempotency key, not a schedule field. A replay
   * returns the stored result and does not append another learning event.
   *
   * evidence_version 1 copies the card from before this rate: due_before,
   * reps_before, state_before, last_review_before, and the injected reviewed_at.
   * payload.due is still the due written by this rate. Old events without
   * evidence_version stay unlabeled; nothing here rewrites them.
   */
  rate(
    cardId: string,
    grade: Grade,
    now: Date = new Date(),
    extra: Record<string, unknown> = {},
  ): RateResult {
    assertNoScheduleFields({ grade, ...extra }, "tide_steward");
    assertMemoryRateExtra(extra);
    const clientEventId = readClientEventId(extra.client_event_id);
    const prior = this.tide.getCard(cardId);
    const evidence = prior
      ? {
          evidence_version: 1 as const,
          due_before: prior.review.due.toISOString(),
          reps_before: prior.review.reps,
          state_before: prior.review.state,
          reviewed_at: now.toISOString(),
          last_review_before: prior.review.last_review
            ? prior.review.last_review.toISOString()
            : null,
        }
      : null;
    const result = this.tide.rate(cardId, grade, now, { clientEventId });
    if (result.replayed) return result;
    this.log.recordRun({
      agent: "tide_steward",
      tools: ["rate"],
      status: "ok",
      input_ref: cardId,
      output_ref: `grade=${grade}`,
    });
    this.log.recordEvent({
      ...(clientEventId ? { id: `retrieval:${clientEventId}` } : {}),
      event_type: "retrieval_grade",
      card_id: cardId,
      payload: {
        grade,
        lexeme_id: result.card.lexeme_id,
        aspect: result.card.aspect,
        due: result.card.review.due.toISOString(),
        scheduled_days: result.card.review.scheduled_days,
        source: "TideScheduler.rate",
        ...(evidence ?? {}),
        ...(clientEventId ? { client_event_id: clientEventId } : {}),
      },
    });
    return result;
  }
}
