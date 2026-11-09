/**
 * PR3: lock/rest card says the reason once; solid primary CTA「去练意思」.
 * Scans review-session.tsx for required / forbidden lock-surface strings.
 * Run: node --import tsx scripts/assert-pr3-lock-rest.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const reviewPath = join(
  new URL("../apps/web/src/components", import.meta.url).pathname,
  "review-session.tsx",
);
const review = readFileSync(reviewPath, "utf8");

const errors = [];

if (!review.includes("去练意思")) {
  errors.push("review-session.tsx missing lock/rest CTA「去练意思」");
}
if (!review.includes("readTodayPracticeHref")) {
  errors.push("lock/rest CTA should reuse today-practice href (PR1/PR2 path)");
}
if (!review.includes("practiceBlocked")) {
  errors.push("review-session.tsx missing practiceBlocked lock surface");
}

// Forbidden triple-stack / happy-talk residue on lock card
const forbidden = [
  "现在只能看看，还不能练",
  "读音这面暂时不练。",
  "点开只读",
  "无解锁按钮",
  "去义界潮汐",
  "未开炉",
];
for (const s of forbidden) {
  if (review.includes(s)) {
    errors.push(`review-session.tsx still has lock-stack / jargon residue: 「${s}」`);
  }
}

// Solid primary for 去练意思: must not be ghost/outline on that button.
// Heuristic: a Button that wraps「去练意思」should not carry variant="ghost" or outline.
const goMeaningIdx = review.indexOf("去练意思");
if (goMeaningIdx === -1) {
  // already recorded
} else {
  const windowStart = Math.max(0, goMeaningIdx - 220);
  const window = review.slice(windowStart, goMeaningIdx);
  if (/variant\s*=\s*["']ghost["']/.test(window) || /variant\s*=\s*["']outline["']/.test(window)) {
    errors.push("「去练意思」must be solid primary (no ghost/outline variant on that Button)");
  }
  if (!/size\s*=\s*["']lg["']/.test(window) && !/<Button[^>]*>\s*\n?\s*去练意思/.test(review)) {
    // soft: prefer size=lg; require at least a Button without demoting variant (checked above)
  }
}

// When blocked, gate banner must not also render (avoid double gateNote)
if (!review.includes("gateNote && !practiceBlocked")) {
  errors.push("blocked lock card should suppress duplicate gateNote banner (!practiceBlocked)");
}

if (errors.length) {
  console.error("PR3 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log("assert-pr3-lock-rest: ok (one-reason lock/rest + solid 去练意思)");
