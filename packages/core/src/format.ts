import type { Aspect, Grade } from "./models/types.js";

export function formatDueShanghai(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/** User-local study day in Asia/Shanghai, YYYY-MM-DD. */
export function dayIdShanghai(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const ASPECT_LABEL: Record<Aspect, string> = {
  form: "拼写",
  meaning: "意思",
  phonology_text: "读音",
};

export const GRADE_LABEL: Record<Grade, { en: string; zh: string }> = {
  1: { en: "Again", zh: "忘了" },
  2: { en: "Hard", zh: "勉强" },
  3: { en: "Good", zh: "记得" },
  4: { en: "Easy", zh: "轻松" },
};

export const STATE_LABEL: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};
