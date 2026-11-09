/**
 * Browser helpers for lesson-first shell (PR5).
 * day-plan / round traces live only in localStorage on Workers deploys.
 */

import { dayIdShanghai } from "@echo-shards/core";
import {
  DAY_PLAN_STORAGE_KEY,
  ROUND_STORAGE_PREFIX,
} from "@/lib/camp-progress-local";

/** True when today's AcceptedDayPlan is present and matches Asia/Shanghai day. */
export function hasTodayDayPlan(storage: Storage = localStorage): boolean {
  try {
    const raw = storage.getItem(DAY_PLAN_STORAGE_KEY);
    if (!raw) return false;
    const plan = JSON.parse(raw) as {
      version?: number;
      day_id?: string;
      variant?: { lexeme_ids?: string[] };
    };
    if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return false;
    return Boolean(plan.variant?.lexeme_ids?.length);
  } catch {
    return false;
  }
}

/**
 * True when any saved review round has at least one tide ReviewLog
 * (学徒已练过；壳用「潮汐 · 再练意思」).
 */
export function hasPracticeLogs(storage: Storage = localStorage): boolean {
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(ROUND_STORAGE_PREFIX)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const saved = JSON.parse(raw) as {
        version?: number;
        tide?: { logs?: unknown[] };
      };
      if (saved.version === 2 && Array.isArray(saved.tide?.logs) && saved.tide.logs.length > 0) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Document / shell title for /review (合签). */
export function reviewShellTitle(hasLogs: boolean): string {
  return hasLogs ? "潮汐 · 再练意思" : "今天练意思";
}

/** Eyebrow above the ritual H1 on first-day vs return. */
export function reviewShellEyebrow(hasLogs: boolean, aspectLabel: string): string {
  return hasLogs ? `潮汐 · 再练意思` : `今天 · ${aspectLabel}`;
}
