/**
 * TideScheduler — 遗忘潮汐调度封装（ts-fsrs）
 *
 * 默认 request_retention = 0.9（ts-fsrs 官方默认，约 90% 陈述保持目标）
 * 可通过构造参数覆盖；勿与「会说」混为同一卡。
 *
 * 没有 setDue / 改写 stability 的入口。评分只能走 rate()，由 ts-fsrs 计算下次 due。
 *
 * snapshot() / restore() are a **local session resume** aid (CLI demo, browser
 * localStorage). The client snapshot is NOT a trusted authority: restore
 * re-derives schedule fields by replaying ReviewLog grades through this
 * instance's FSRS engine (same params as rate). Tampered due / stability /
 * reps that disagree with the log chain are rejected. True schedule writes
 * still only happen via rate().
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FSRSCard,
  type Grade as FSRSGrade,
  type FSRS,
} from "ts-fsrs";
import {
  CardSchema,
  ReviewLogSchema,
  type Aspect,
  type Card,
  type Grade,
  type Lexeme,
  type ReviewLog,
  type SessionBatch,
} from "../models/types.js";

/** Deterministic card id. TOPRA: one track per (learner × lexeme × aspect). */
export function cardIdFor(userId: string, lexemeId: string, aspect: Aspect): string {
  return `${userId}:${lexemeId}:${aspect}`;
}

/** Split `user:lexeme:aspect` card ids. Lexeme ids may contain `:` (joined middle). */
export function parseCardId(
  cardId: string,
): { userId: string; lexemeId: string; aspect: Aspect } | null {
  const parts = cardId.split(":");
  if (parts.length < 3) return null;
  const aspectRaw = parts[parts.length - 1]!;
  if (
    aspectRaw !== "form" &&
    aspectRaw !== "meaning" &&
    aspectRaw !== "phonology_text"
  ) {
    return null;
  }
  const userId = parts[0]!;
  const lexemeId = parts.slice(1, -1).join(":");
  if (!userId || !lexemeId) return null;
  return { userId, lexemeId, aspect: aspectRaw };
}

export interface TideSchedulerOptions {
  /** 目标保留率；默认 0.9（合理起步，封闭测试后再调） */
  requestRetention?: number;
  /** 最大间隔天数；默认 365 */
  maximumInterval?: number;
  /** 是否启用短期调度；默认 true（学习步） */
  enableShortTerm?: boolean;
}

export interface RateResult {
  card: Card;
  log: ReviewLog;
  fsrsCard: FSRSCard;
}

/** JSON-shaped session blob; dates revive through Zod on restore. */
export interface TideSnapshot {
  cards: unknown[];
  logs: unknown[];
}

export class TideRestoreError extends Error {
  readonly breach = "tide_restore" as const;

  constructor(message: string) {
    super(message);
    this.name = "TideRestoreError";
  }
}

const DEFAULT_RETENTION = 0.9;
const DEFAULT_MAX_INTERVAL = 365;
const FLOAT_EPS = 1e-6;

function reviewFromFsrs(c: FSRSCard) {
  return {
    state: c.state as number,
    due: c.due instanceof Date ? c.due : new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps,
    last_review: c.last_review
      ? c.last_review instanceof Date
        ? c.last_review
        : new Date(c.last_review)
      : undefined,
  };
}

function toFsrsCard(card: Card): FSRSCard {
  const r = card.review;
  return {
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    learning_steps: r.learning_steps ?? 0,
    state: r.state,
    last_review: r.last_review,
  } as FSRSCard;
}

function sameInstant(a: Date | undefined, b: Date | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= FLOAT_EPS;
}

export class TideScheduler {
  private readonly engine: FSRS;
  private readonly cards = new Map<string, Card>();
  private readonly logs: ReviewLog[] = [];
  readonly requestRetention: number;

  constructor(options: TideSchedulerOptions = {}) {
    this.requestRetention = options.requestRetention ?? DEFAULT_RETENTION;
    const params = generatorParameters({
      request_retention: this.requestRetention,
      maximum_interval: options.maximumInterval ?? DEFAULT_MAX_INTERVAL,
      enable_short_term: options.enableShortTerm ?? true,
    });
    this.engine = fsrs(params);
  }

  /** 为 lexeme 的某一 aspect 入队一张新卡（TOPRA 分轨） */
  enqueueNew(
    userId: string,
    lexeme: Pick<Lexeme, "id">,
    aspect: Aspect,
    now: Date = new Date(),
  ): Card {
    const id = cardIdFor(userId, lexeme.id, aspect);
    if (this.cards.has(id)) {
      return this.cards.get(id)!;
    }
    const empty = createEmptyCard(now);
    const card: Card = {
      id,
      user_id: userId,
      lexeme_id: lexeme.id,
      aspect,
      review: reviewFromFsrs(empty),
    };
    this.cards.set(id, card);
    return card;
  }

  /** 为词表批量入队某一 aspect（三界一轮） */
  enqueueAspectBatch(
    userId: string,
    lexemes: Lexeme[],
    aspect: Aspect,
    now: Date = new Date(),
  ): Card[] {
    return lexemes.map((lx) => this.enqueueNew(userId, lx, aspect, now));
  }

  getCard(cardId: string): Card | undefined {
    return this.cards.get(cardId);
  }

  allCards(): Card[] {
    return [...this.cards.values()];
  }

  /** 到期卡（due <= now），可按 aspect 过滤 */
  getDue(now: Date = new Date(), aspect?: Aspect): Card[] {
    return this.allCards()
      .filter((c) => c.review.due.getTime() <= now.getTime())
      .filter((c) => (aspect ? c.aspect === aspect : true))
      .sort((a, b) => a.review.due.getTime() - b.review.due.getTime());
  }

  /** 评分并推进调度 */
  rate(cardId: string, grade: Grade, now: Date = new Date()): RateResult {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);

    const before = toFsrsCard(card);
    // Grade 1–4 对齐 ts-fsrs Rating.Again…Easy（不含 Manual）
    const record = this.engine.next(before, now, grade as FSRSGrade);
    const updated: Card = {
      ...card,
      review: reviewFromFsrs(record.card),
    };
    this.cards.set(cardId, updated);

    const log: ReviewLog = {
      id: `log_${cardId}_${now.getTime()}`,
      card_id: cardId,
      user_id: card.user_id,
      grade,
      reviewed_at: now,
      state_before: before.state as number,
      scheduled_days: record.card.scheduled_days,
    };
    this.logs.push(log);
    return { card: updated, log, fsrsCard: record.card };
  }

  getLogs(): ReviewLog[] {
    return [...this.logs];
  }

  /** 组装 SessionBatch：默认取最多 5 张到期（或新）卡 */
  buildSessionBatch(
    userId: string,
    aspect: Aspect,
    limit = 5,
    now: Date = new Date(),
  ): SessionBatch {
    const due = this.getDue(now, aspect).filter((c) => c.user_id === userId);
    const picked = due.slice(0, limit);
    return {
      id: `batch_${userId}_${aspect}_${now.getTime()}`,
      user_id: userId,
      aspect,
      lexeme_ids: picked.map((c) => c.lexeme_id),
      card_ids: picked.map((c) => c.id),
      created_at: now,
    };
  }

  /**
   * Local-session snapshot. Not a trusted schedule authority —
   * restore() replays logs; only rate() advances due.
   */
  snapshot(): { cards: Card[]; logs: ReviewLog[] } {
    return { cards: this.allCards(), logs: this.getLogs() };
  }

  /**
   * Resume from a prior snapshot(). Validates Zod shape + cards↔logs
   * consistency, then re-derives each card's review via FSRS replay of
   * that card's ReviewLog chain (same engine params as rate).
   *
   * Never-rated cards (no logs) are rematerialized with createEmptyCard(now)
   * so a hand-edited localStorage due cannot hide or invent schedule state.
   *
   * On any integrity failure, throws TideRestoreError and leaves this
   * instance unchanged.
   */
  restore(state: TideSnapshot, now: Date = new Date()): void {
    const accepted = this.validateAndMaterialize(state, now);
    this.cards.clear();
    this.logs.length = 0;
    for (const card of accepted.cards) {
      this.cards.set(card.id, card);
    }
    this.logs.push(...accepted.logs);
  }

  private validateAndMaterialize(
    state: TideSnapshot,
    now: Date,
  ): { cards: Card[]; logs: ReviewLog[] } {
    if (!state || !Array.isArray(state.cards) || !Array.isArray(state.logs)) {
      throw new TideRestoreError("snapshot must provide cards[] and logs[]");
    }

    let cards: Card[];
    let logs: ReviewLog[];
    try {
      cards = state.cards.map((raw) => CardSchema.parse(raw));
      logs = state.logs.map((raw) => ReviewLogSchema.parse(raw));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new TideRestoreError(`snapshot failed schema parse: ${detail}`);
    }

    const cardIds = new Set<string>();
    for (const card of cards) {
      if (cardIds.has(card.id)) {
        throw new TideRestoreError(`duplicate card id ${card.id}`);
      }
      cardIds.add(card.id);
      const expected = cardIdFor(card.user_id, card.lexeme_id, card.aspect);
      if (card.id !== expected) {
        throw new TideRestoreError(
          `card id ${card.id} does not match TOPRA key ${expected}`,
        );
      }
    }

    const logIds = new Set<string>();
    for (const log of logs) {
      if (logIds.has(log.id)) {
        throw new TideRestoreError(`duplicate log id ${log.id}`);
      }
      logIds.add(log.id);
      if (!cardIds.has(log.card_id)) {
        throw new TideRestoreError(`orphan log ${log.id} card_id ${log.card_id}`);
      }
    }

    const logsByCard = new Map<string, ReviewLog[]>();
    for (const log of logs) {
      const list = logsByCard.get(log.card_id) ?? [];
      list.push(log);
      logsByCard.set(log.card_id, list);
    }
    for (const [cardId, list] of logsByCard) {
      list.sort((a, b) => a.reviewed_at.getTime() - b.reviewed_at.getTime());
      for (let i = 1; i < list.length; i++) {
        if (list[i]!.reviewed_at.getTime() === list[i - 1]!.reviewed_at.getTime()) {
          throw new TideRestoreError(
            `logs for ${cardId} share reviewed_at (ambiguous replay order)`,
          );
        }
      }
      logsByCard.set(cardId, list);
    }

    const materialized: Card[] = [];
    for (const card of cards) {
      const cardLogs = logsByCard.get(card.id) ?? [];
      if (card.review.reps !== cardLogs.length) {
        throw new TideRestoreError(
          `card ${card.id} reps=${card.review.reps} but log count=${cardLogs.length}`,
        );
      }

      const cardUserMismatch = cardLogs.find((l) => l.user_id !== card.user_id);
      if (cardUserMismatch) {
        throw new TideRestoreError(
          `log ${cardUserMismatch.id} user_id does not match card ${card.id}`,
        );
      }

      if (cardLogs.length === 0) {
        // Unreviewed: discard snapshot schedule fields; rematerialize empty.
        if (card.review.last_review) {
          throw new TideRestoreError(
            `card ${card.id} has last_review but no logs`,
          );
        }
        materialized.push({
          id: card.id,
          user_id: card.user_id,
          lexeme_id: card.lexeme_id,
          aspect: card.aspect,
          review: reviewFromFsrs(createEmptyCard(now)),
        });
        continue;
      }

      if (!sameInstant(card.review.last_review, cardLogs[cardLogs.length - 1]!.reviewed_at)) {
        throw new TideRestoreError(
          `card ${card.id} last_review does not match final log reviewed_at`,
        );
      }

      let cur = createEmptyCard(cardLogs[0]!.reviewed_at);
      for (const log of cardLogs) {
        if ((cur.state as number) !== log.state_before) {
          throw new TideRestoreError(
            `log ${log.id} state_before=${log.state_before} != replay state=${cur.state}`,
          );
        }
        const record = this.engine.next(cur, log.reviewed_at, log.grade as FSRSGrade);
        cur = record.card;
        if (
          log.scheduled_days !== undefined &&
          log.scheduled_days !== record.card.scheduled_days
        ) {
          throw new TideRestoreError(
            `log ${log.id} scheduled_days=${log.scheduled_days} != replay ${record.card.scheduled_days}`,
          );
        }
      }

      const replayed = reviewFromFsrs(cur);
      assertReviewMatchesSnapshot(card.id, card.review, replayed);
      materialized.push({
        id: card.id,
        user_id: card.user_id,
        lexeme_id: card.lexeme_id,
        aspect: card.aspect,
        // Prefer replayed schedule fields — snapshot due is never authoritative.
        review: replayed,
      });
    }

    // Preserve original log array order (already Zod-parsed); per-card order checked above.
    return { cards: materialized, logs };
  }
}

function assertReviewMatchesSnapshot(
  cardId: string,
  claimed: Card["review"],
  replayed: Card["review"],
): void {
  const checks: Array<[string, boolean]> = [
    ["due", sameInstant(claimed.due, replayed.due)],
    ["stability", approxEqual(claimed.stability, replayed.stability)],
    ["difficulty", approxEqual(claimed.difficulty, replayed.difficulty)],
    ["elapsed_days", claimed.elapsed_days === replayed.elapsed_days],
    ["scheduled_days", claimed.scheduled_days === replayed.scheduled_days],
    ["reps", claimed.reps === replayed.reps],
    ["lapses", claimed.lapses === replayed.lapses],
    ["state", claimed.state === replayed.state],
    ["last_review", sameInstant(claimed.last_review, replayed.last_review)],
    [
      "learning_steps",
      (claimed.learning_steps ?? 0) === (replayed.learning_steps ?? 0),
    ],
  ];
  const bad = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (bad.length > 0) {
    throw new TideRestoreError(
      `card ${cardId} schedule fields disagree with FSRS log replay: ${bad.join(", ")}`,
    );
  }
}

export { DEFAULT_RETENTION };
