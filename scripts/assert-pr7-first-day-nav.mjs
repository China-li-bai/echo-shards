/**
 * PR7: first-day nav progressive disclosure —
 * 潮汐/市集 gated until hasFirstMeaningSuccess; 合签「练完一轮再来」;
 * 市集首见「意思练过一轮，可以来市集试试。」.
 * Run: node --import tsx scripts/assert-pr7-first-day-nav.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = new URL("../apps/web/src", import.meta.url).pathname;
const errors = [];

function read(rel) {
  return readFileSync(join(webSrc, rel), "utf8");
}

const learnerLocal = read("lib/learner-practice-local.ts");
const siteHeader = read("components/site-header.tsx");
const campCta = read("components/camp-practice-cta.tsx");
const campSteps = read("components/camp-today-steps.tsx");
const campPage = read("app/page.tsx");
const bazaarNote = read("components/bazaar-first-seen-note.tsx");
const questsPage = read("app/quests/page.tsx");

if (!learnerLocal.includes("hasFirstMeaningSuccess")) {
  errors.push("learner-practice-local missing hasFirstMeaningSuccess");
}
if (!learnerLocal.includes("grade >= 3") && !learnerLocal.includes("grade >=3")) {
  errors.push("hasFirstMeaningSuccess must require grade >= 3 (Good/Easy)");
}
if (!learnerLocal.includes("首成功") || !learnerLocal.includes("SUCCESS_GRADE_MIN")) {
  errors.push("hasFirstMeaningSuccess must document「首成功」判据 in comments");
}
if (!siteHeader.includes("hasFirstMeaningSuccess")) {
  errors.push("site-header must gate on hasFirstMeaningSuccess");
}
if (!siteHeader.includes("练完一轮再来")) {
  errors.push("site-header missing灰态旁注「练完一轮再来」");
}
if (!siteHeader.includes('aria-disabled="true"') && !siteHeader.includes("aria-disabled={'true'}")) {
  errors.push("site-header locked nav items must be aria-disabled");
}
if (!campCta.includes("hasFirstMeaningSuccess")) {
  errors.push("camp-practice-cta must gate bazaar on hasFirstMeaningSuccess");
}
if (!campCta.includes("练完一轮再来")) {
  errors.push("camp-practice-cta missing locked旁注「练完一轮再来」");
}
if (!campCta.includes("意思练过一轮，可以来市集试试。")) {
  errors.push("camp-practice-cta missing市集首见旁注");
}
if (!campSteps.includes("hasFirstMeaningSuccess") || !campSteps.includes("requiresFirstSuccess")) {
  errors.push("camp-today-steps must gate tide/bazaar steps");
}
if (!campSteps.includes("练完一轮再来")) {
  errors.push("camp-today-steps missing灰态旁注「练完一轮再来」");
}
if (!campPage.includes("CampTodaySteps") || !campPage.includes("requiresFirstSuccess: true")) {
  errors.push("camp page must use CampTodaySteps with requiresFirstSuccess for 潮汐/市集");
}
if (!bazaarNote.includes("意思练过一轮，可以来市集试试。")) {
  errors.push("bazaar-first-seen-note missing合签句");
}
if (!questsPage.includes("BazaarFirstSeenNote")) {
  errors.push("quests page should show BazaarFirstSeenNote");
}
// Must not weaken day/camp primary path
if (!campCta.includes("开始今天的练习") || !campCta.includes("先认识几个词，再试着记起来。")) {
  errors.push("camp CTA lesson-first copy must stay intact");
}

if (errors.length) {
  console.error("PR7 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log(
  "assert-pr7-first-day-nav: ok (first-success gate, header+camp+quests, 合签旁注)",
);
