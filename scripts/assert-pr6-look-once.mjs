/**
 * PR6: recognition half-beat「先看一眼」— word+gloss+example walk,
 * close「看过了，试着写意思」, skip only with logs, first-day「没想起来」.
 * Run: node --import tsx scripts/assert-pr6-look-once.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = new URL("../apps/web/src", import.meta.url).pathname;
const errors = [];

function read(rel) {
  return readFileSync(join(webSrc, rel), "utf8");
}

const lookGate = read("components/look-ahead-gate.tsx");
const lookPage = read("app/look/page.tsx");
const dayDesk = read("components/day-desk.tsx");
const reviewSession = read("components/review-session.tsx");
const todayHref = read("lib/today-practice-href.ts");
const content = read("lib/content.ts");

if (!lookGate.includes("看一眼意思；等下自己想起来。")) {
  errors.push("look-ahead-gate missing guide copy「看一眼意思；等下自己想起来。」");
}
if (!lookGate.includes("下一个")) {
  errors.push("look-ahead-gate missing「下一个」");
}
if (!lookGate.includes("看过了，试着写意思")) {
  errors.push("look-ahead-gate missing close CTA「看过了，试着写意思」");
}
if (!lookGate.includes("已经练过 · 直接回忆")) {
  errors.push("look-ahead-gate missing skip CTA「已经练过 · 直接回忆」");
}
if (!lookGate.includes("hasPracticeLogs")) {
  errors.push("look-ahead-gate skip must gate on hasPracticeLogs");
}
if (lookGate.includes("进入意思练习") || lookGate.includes("不假装半拍")) {
  errors.push("look-ahead-gate still has PR5 placeholder honest CTA");
}
if (!lookGate.includes("gloss_zh") || !lookGate.includes("orthography")) {
  errors.push("look-ahead-gate must show English orthography + Chinese gloss");
}
if (!lookGate.includes("example_sentence")) {
  errors.push("look-ahead-gate must support optional example_sentence");
}
if (!lookPage.includes("getLookCards")) {
  errors.push("look page should load cards via getLookCards");
}
if (!content.includes("export interface LookCard") || !content.includes("getLookCards")) {
  errors.push("content.ts missing LookCard / getLookCards");
}
if (!dayDesk.includes("/look?")) {
  errors.push("day-desk must enter /look for half-beat");
}
if (!todayHref.includes("/look?")) {
  errors.push("today-practice-href should default into /look (PR6)");
}
if (todayHref.includes("return `/review?")) {
  errors.push("today-practice-href should not jump straight to /review when plan exists");
}
if (!reviewSession.includes("没想起来")) {
  errors.push("review-session missing first-day grade「没想起来」");
}
if (!reviewSession.includes("isFirstPractice")) {
  errors.push("review-session first-day grade must key off isFirstPractice");
}

if (errors.length) {
  console.error("PR6 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log(
  "assert-pr6-look-once: ok (half-beat copy, skip+logs, day/camp→/look, 没想起来)",
);
