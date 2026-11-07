/**
 * PR5: lesson-first shell & naming — no「潮汐复习」; cold-start / return titles;
 * day CTA「先看一眼」; camp subtitle; bare-/review gate; recall badges.
 * Run: node --import tsx scripts/assert-pr5-lesson-first-shell.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = new URL("../apps/web/src", import.meta.url).pathname;
const errors = [];

function read(rel) {
  return readFileSync(join(webSrc, rel), "utf8");
}

const reviewPage = read("app/review/page.tsx");
const reviewShell = read("components/review-page-shell.tsx");
const reviewSession = read("components/review-session.tsx");
const campCta = read("components/camp-practice-cta.tsx");
const dayDesk = read("components/day-desk.tsx");
const lookPage = read("app/look/page.tsx");
const lookGate = read("components/look-ahead-gate.tsx");
const learnerLocal = read("lib/learner-practice-local.ts");

if (reviewPage.includes("潮汐复习") || reviewShell.includes("潮汐复习")) {
  errors.push("review shell still contains「潮汐复习」");
}
if (!reviewPage.includes('title: "今天练意思"') && !reviewShell.includes("今天练意思")) {
  errors.push("missing cold-start title「今天练意思」");
}
if (!learnerLocal.includes("潮汐 · 再练意思") || !learnerLocal.includes("今天练意思")) {
  errors.push("learner-practice-local missing shell title helpers");
}
if (!reviewShell.includes("先安排今天的练习") || !reviewShell.includes("去日课")) {
  errors.push("bare /review gate missing「先安排今天的练习」+「去日课」");
}
if (!reviewShell.includes("hasTodayDayPlan")) {
  errors.push("review-page-shell must gate on hasTodayDayPlan");
}
if (!reviewSession.includes("新词 · 第一次练") || !reviewSession.includes('"再练"')) {
  errors.push("review-session missing recall badges「新词 · 第一次练」/「再练」");
}
if (!campCta.includes("先认识几个词，再试着记起来。")) {
  errors.push("camp-practice-cta missing lesson-first subtitle");
}
if (!dayDesk.includes("今天先认识几个词，再试着记起来")) {
  errors.push("day-desk missing lesson-first main sentence");
}
if (!dayDesk.includes('"先看一眼"')) {
  errors.push("day-desk cold-start button must be「先看一眼」");
}
if (dayDesk.includes('"开始练意思"')) {
  errors.push("day-desk still has cold-start「开始练意思」(should be「先看一眼」)");
}
if (!dayDesk.includes("`/look?") && !dayDesk.includes("/look?")) {
  errors.push("day-desk one-click path should enter /look skeleton");
}
if (!lookPage.includes("先看一眼") || !lookGate.includes("进入意思练习")) {
  errors.push("look skeleton must title「先看一眼」and CTA without claiming already looked");
}
if (/看过了，试着写意思/.test(lookGate) || /记住了，开始回忆/.test(lookGate)) {
  errors.push("look-ahead-gate must not use half-beat close copy (PR6 only)");
}
if (!lookGate.includes("进入意思练习")) {
  errors.push("look-ahead-gate CTA should be honest「进入意思练习」");
}

if (errors.length) {
  console.error("PR5 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log(
  "assert-pr5-lesson-first-shell: ok (shell titles, bare gate, badges, camp/day copy, /look skeleton)",
);
