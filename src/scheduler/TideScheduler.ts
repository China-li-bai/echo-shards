/**
 * TideScheduler — 遗忘潮汐调度封装（ts-fsrs）
 *
 * 默认 request_retention = 0.9（ts-fsrs 官方默认，约 90% 陈述保持目标）
 * 可通过构造参数覆盖；勿与「会说」混为同一卡。
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FSRSCard,
  type Grade as FSRSGrade,
  type FSRS,
} from "ts-fsrs";
import type { Aspect, Card, Grade, Lexeme, ReviewLog, SessionBatch } from "../models/types.js";

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

const DEFAULT_RETENTION = 0.9;
const DEFAULT_MAX_INTERVAL = 365;

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
    lexeme: Lexeme,
    aspect: Aspect,
    now: Date = new Date(),
  ): Card {
    const id = `${userId}:${lexeme.id}:${aspect}`;
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
}

export { DEFAULT_RETENTION };
