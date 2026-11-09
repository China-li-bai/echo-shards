/**
 * PR8 演示卫生：清空本机学徒练习痕迹（localStorage）。
 *
 * ## 清哪些（前缀 / 精确键）
 * 生产路径写入的键：
 * - `echo-shards.day-plan.v1` — 当日 AcceptedDayPlan + 嵌入 event_log
 * - `echo-shards.round.v2:*` — 潮汐 SavedRound（tide logs / 评分）
 * - `echo-shards.quest-log.v1` — 市集 / quest-desk AgentEventLog
 *
 * 原型页同域污染（artifacts HTML 原型，非主路径）：
 * - `echo-shards.proto.*` — day-tide-loop 等原型存档
 *
 * 实现用统一前缀 `echo-shards.`：词表 / 静态资源在 bundle，不进 localStorage；
 * 冷启动文档亦要求清 `echo-shards.*`。未来若新增学徒进度键，只要仍用此前缀即可被清掉。
 *
 * ## 不清哪些
 * - 词表、enrichment、quest YAML 等静态内容（不在 LS）
 * - 非 `echo-shards.` 的键
 * - Workers / 服务端账本（学徒进度本就无服务端权威源）
 *
 * 不改 FSRS / due / 同日单方面 / 跨夜调度硬规则——只删本机痕迹，调度引擎本身不变。
 */

import {
  DAY_PLAN_STORAGE_KEY,
  QUEST_LOG_STORAGE_KEY,
  ROUND_STORAGE_PREFIX,
} from "./camp-progress-local";

/** All learner / demo localStorage keys share this prefix. */
export const LEARNER_STORAGE_PREFIX = "echo-shards.";

/** Documented exact keys (whitelist commentary; deletion uses prefix). */
export const PRACTICE_STORAGE_EXACT_KEYS = [
  DAY_PLAN_STORAGE_KEY,
  QUEST_LOG_STORAGE_KEY,
] as const;

/** Documented prefixes under LEARNER_STORAGE_PREFIX. */
export const PRACTICE_STORAGE_PREFIXES = [
  ROUND_STORAGE_PREFIX,
  "echo-shards.proto.",
] as const;

/** 合签按钮文案（PR8）。 */
export const CLEAR_PRACTICE_BUTTON_LABEL = "清空练习记录";

/** 合签说明（PR8）。 */
export const CLEAR_PRACTICE_HELP =
  "只清这台设备上的练习进度，词表还在。";

/** 合签确认（PR8）；须确认后才清。 */
export const CLEAR_PRACTICE_CONFIRM = "确定清空？";

/** List `echo-shards.*` keys currently in storage (order stable for tests). */
export function listLearnerStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(LEARNER_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys.sort();
}

/**
 * Remove all `echo-shards.*` localStorage entries.
 * Returns the keys that were removed (sorted).
 */
export function clearPracticeRecords(storage: Storage): string[] {
  const keys = listLearnerStorageKeys(storage);
  for (const key of keys) {
    storage.removeItem(key);
  }
  return keys;
}
