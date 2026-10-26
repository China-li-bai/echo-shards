/**
 * 单词潮汐三件套 · 编排闸门（P0）
 *
 * - 从 Tide cards + ReviewLog 派生跨夜成功日 / 界解锁态 / 同日可出哪一界
 * - 只过滤编排，不写 / 不改 due（TideScheduler.rate 仍是唯一写 due 入口）
 * - 成功假设：当前路径均为主动提取（回忆/产出后 grade）；尚无独立「再认点选」事件，
 *   故 grade≥Good(3) 计入 N。若日后拆出 recognition 事件，默认不应计入 N。
 */

import { ASPECT_LABEL, dayIdShanghai } from "../format.js";
import type { Aspect, Card, Grade, ReviewLog } from "../models/types.js";
import { parseCardId } from "../scheduler/TideScheduler.js";

/** P1 可挂学徒滑杆 / 后台开关；学徒 UI 默认不可见。 */
export const WORD_TIDE_CONFIG = {
  crossNightSuccessN: 2,
  /** 解锁链默认顺序；音界默认不进链。 */
  aspectOrder: ["meaning", "form"] as const satisfies readonly Aspect[],
  phonologyInUnlockChain: false,
} as const;

export type WordTideConfig = {
  crossNightSuccessN: number;
  aspectOrder: readonly Aspect[];
  phonologyInUnlockChain: boolean;
};

export type AspectUnlockState = "locked" | "active" | "unlocked_next";

/** 学徒规则卡关键句（禁止「已掌握 / 通关 / 学完」）。 */
export const WORD_TIDE_COPY = {
  /** 规则卡 1 */
  lockedNext: (next: Aspect, prev: Aspect) =>
    `${ASPECT_LABEL[next]}未开炉 · 先把${ASPECT_LABEL[prev]}锻过今夜`,
  /** 规则卡 2 */
  forgedTodayNeedNight: "今日锻成一次 · 过今夜再来，才算开下一界",
  /** 规则卡 3 */
  forgeOpen: (aspect: Aspect) => `${ASPECT_LABEL[aspect]}开炉`,
  /** 规则卡 4 */
  sameDayDefer: "今日只锻一界 · 另界潮汐顺延",
  /** 规则卡 5 */
  phonologyRest: "音界工坊休整中",
  /** 规则卡 7 */
  needCrossNightShape: "要隔夜再对上才开下一界",
  /** 规则卡 8 */
  phonologyTrial: "音界试炼开炉 · 写出音标串（不等于会开口）",
  /** 规则卡 9 */
  shardLit: "残片亮起=这一界锻过跨夜",
  /** 规则卡 10 */
  failKeepCount: "今日未锻成 · 计数不清空，改日再来",
  /** 规则卡 11 */
  incidental: "路上遇见过 · 潮汐仍要亲自锻",
} as const;

/** Good / Easy — 主动提取成功（与 shard-wall SUCCESS_GRADES 对齐）。 */
const SUCCESS_GRADE_MIN: Grade = 3;

export function unlockChainAspects(
  config: WordTideConfig = WORD_TIDE_CONFIG,
): Aspect[] {
  const chain = [...config.aspectOrder];
  if (config.phonologyInUnlockChain && !chain.includes("phonology_text")) {
    chain.push("phonology_text");
  }
  return chain;
}

/**
 * 某 lemma×aspect 上计入 N 的跨夜成功日（Asia/Shanghai，去重）。
 * 失败不清零：本函数只收集成功日，不因 Again/Hard 抹除。
 */
export function crossNightSuccessDays(input: {
  lexemeId: string;
  aspect: Aspect;
  logs: readonly ReviewLog[];
  /** 可选：若缺 card_id 解析，用 cards 反查。 */
  cards?: readonly Card[];
}): string[] {
  const cardIds = new Set<string>();
  for (const card of input.cards ?? []) {
    if (card.lexeme_id === input.lexemeId && card.aspect === input.aspect) {
      cardIds.add(card.id);
    }
  }
  const days = new Set<string>();
  for (const log of input.logs) {
    if (log.grade < SUCCESS_GRADE_MIN) continue;
    const parsed = parseCardId(log.card_id);
    const match =
      (parsed &&
        parsed.lexemeId === input.lexemeId &&
        parsed.aspect === input.aspect) ||
      cardIds.has(log.card_id);
    if (!match) continue;
    days.add(dayIdShanghai(log.reviewed_at));
  }
  return [...days].sort();
}

export function isUnlockedNext(
  lexemeId: string,
  aspect: Aspect,
  logs: readonly ReviewLog[],
  config: WordTideConfig = WORD_TIDE_CONFIG,
  cards?: readonly Card[],
): boolean {
  const days = crossNightSuccessDays({ lexemeId, aspect, logs, cards });
  return days.length >= config.crossNightSuccessN;
}

/**
 * 每 lemma×aspect 解锁态。
 * - 音界默认不进链 → locked（学徒侧「休整中」）
 * - 链首（义）无前置 → active 或 unlocked_next
 * - 后续界需前置 unlocked_next
 */
export function deriveAspectUnlockState(
  lexemeId: string,
  aspect: Aspect,
  logs: readonly ReviewLog[],
  config: WordTideConfig = WORD_TIDE_CONFIG,
  cards?: readonly Card[],
): AspectUnlockState {
  const chain = unlockChainAspects(config);
  if (aspect === "phonology_text" && !config.phonologyInUnlockChain) {
    return "locked";
  }
  const idx = chain.indexOf(aspect);
  if (idx < 0) return "locked";

  for (let i = 0; i < idx; i++) {
    const prev = chain[i]!;
    if (!isUnlockedNext(lexemeId, prev, logs, config, cards)) {
      return "locked";
    }
  }
  if (isUnlockedNext(lexemeId, aspect, logs, config, cards)) {
    return "unlocked_next";
  }
  return "active";
}

/** 同日撞车时的优先分：未完成(active)优先于已开下一界(unlocked_next)；再按链序。 */
function priorityScore(
  lexemeId: string,
  aspect: Aspect,
  logs: readonly ReviewLog[],
  config: WordTideConfig,
  cards?: readonly Card[],
): number | null {
  const state = deriveAspectUnlockState(lexemeId, aspect, logs, config, cards);
  if (state === "locked") return null;
  const chain = unlockChainAspects(config);
  const idx = chain.indexOf(aspect);
  if (idx < 0) return null;
  const unfinishedBoost = state === "active" ? 0 : 100;
  return unfinishedBoost + idx;
}

export interface DueGateResult {
  kept: Card[];
  deferred: Card[];
  lockedOut: Card[];
  sameDayCollision: boolean;
}

/**
 * 编排层过滤：同 lemma 同日只留优先未完成界；锁态 / 音界休整剔除。
 * 不修改 card.review.due。
 */
export function filterDueByWordTideGate(input: {
  dueCards: readonly Card[];
  logs: readonly ReviewLog[];
  /** 若指定，结果 kept 只含该 aspect（仍按全量 due 判撞车）。 */
  targetAspect?: Aspect;
  config?: WordTideConfig;
  cards?: readonly Card[];
}): DueGateResult {
  const config = input.config ?? WORD_TIDE_CONFIG;
  const cards = input.cards ?? input.dueCards;
  const lockedOut: Card[] = [];
  const candidates: Card[] = [];

  for (const card of input.dueCards) {
    const state = deriveAspectUnlockState(
      card.lexeme_id,
      card.aspect,
      input.logs,
      config,
      cards,
    );
    if (state === "locked") {
      lockedOut.push(card);
      continue;
    }
    candidates.push(card);
  }

  const byLemma = new Map<string, Card[]>();
  for (const card of candidates) {
    const list = byLemma.get(card.lexeme_id) ?? [];
    list.push(card);
    byLemma.set(card.lexeme_id, list);
  }

  const kept: Card[] = [];
  const deferred: Card[] = [];
  let sameDayCollision = false;

  for (const [, group] of byLemma) {
    if (group.length === 1) {
      kept.push(group[0]!);
      continue;
    }
    let best: Card | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const card of group) {
      const score = priorityScore(
        card.lexeme_id,
        card.aspect,
        input.logs,
        config,
        cards,
      );
      if (score === null) continue;
      if (
        score < bestScore ||
        (score === bestScore &&
          card.review.due.getTime() < (best?.review.due.getTime() ?? Infinity))
      ) {
        best = card;
        bestScore = score;
      }
    }
    if (!best) {
      lockedOut.push(...group);
      continue;
    }
    sameDayCollision = true;
    for (const card of group) {
      if (card.id === best.id) kept.push(card);
      else deferred.push(card);
    }
  }

  // Stable: due ascending
  kept.sort((a, b) => a.review.due.getTime() - b.review.due.getTime());

  const filteredKept = input.targetAspect
    ? kept.filter((c) => c.aspect === input.targetAspect)
    : kept;

  return {
    kept: filteredKept,
    deferred,
    lockedOut,
    sameDayCollision,
  };
}

/** 前置界（用于锁态旁注）。 */
export function previousAspectInChain(
  aspect: Aspect,
  config: WordTideConfig = WORD_TIDE_CONFIG,
): Aspect | null {
  const chain = unlockChainAspects(config);
  const idx = chain.indexOf(aspect);
  if (idx <= 0) return null;
  return chain[idx - 1] ?? null;
}

/** 下一界（开炉文案）。 */
export function nextAspectInChain(
  aspect: Aspect,
  config: WordTideConfig = WORD_TIDE_CONFIG,
): Aspect | null {
  const chain = unlockChainAspects(config);
  const idx = chain.indexOf(aspect);
  if (idx < 0 || idx >= chain.length - 1) return null;
  return chain[idx + 1] ?? null;
}

/**
 * 评分后学徒短句（规则卡 2 / 3 / 10）。
 * 不声称改 due。
 */
export function apprenticeNoteAfterGrade(input: {
  lexemeId: string;
  aspect: Aspect;
  grade: Grade;
  logs: readonly ReviewLog[];
  now?: Date;
  config?: WordTideConfig;
  cards?: readonly Card[];
}): string {
  const config = input.config ?? WORD_TIDE_CONFIG;
  if (input.grade < SUCCESS_GRADE_MIN) {
    return WORD_TIDE_COPY.failKeepCount;
  }
  const days = crossNightSuccessDays({
    lexemeId: input.lexemeId,
    aspect: input.aspect,
    logs: input.logs,
    cards: input.cards,
  });
  const next = nextAspectInChain(input.aspect, config);
  if (
    next &&
    days.length >= config.crossNightSuccessN &&
    isUnlockedNext(input.lexemeId, input.aspect, input.logs, config, input.cards)
  ) {
    // 刚跨过 N：下一界开炉
    const crossedToday =
      days[config.crossNightSuccessN - 1] ===
      dayIdShanghai(input.now ?? new Date());
    if (crossedToday || days.length === config.crossNightSuccessN) {
      return WORD_TIDE_COPY.forgeOpen(next);
    }
  }
  if (days.length < config.crossNightSuccessN) {
    return WORD_TIDE_COPY.forgedTodayNeedNight;
  }
  return WORD_TIDE_COPY.needCrossNightShape;
}

/** 锁态 / 休整旁注。 */
export function apprenticeLockNote(
  lexemeId: string,
  aspect: Aspect,
  logs: readonly ReviewLog[],
  config: WordTideConfig = WORD_TIDE_CONFIG,
  cards?: readonly Card[],
): string | null {
  if (aspect === "phonology_text" && !config.phonologyInUnlockChain) {
    return WORD_TIDE_COPY.phonologyRest;
  }
  const state = deriveAspectUnlockState(lexemeId, aspect, logs, config, cards);
  if (state !== "locked") return null;
  const prev = previousAspectInChain(aspect, config);
  if (!prev) return WORD_TIDE_COPY.needCrossNightShape;
  return WORD_TIDE_COPY.lockedNext(aspect, prev);
}

/** 日课 / 提案：音界默认是否出现。 */
export function defaultIncludePhonology(
  config: WordTideConfig = WORD_TIDE_CONFIG,
): boolean {
  return config.phonologyInUnlockChain;
}
