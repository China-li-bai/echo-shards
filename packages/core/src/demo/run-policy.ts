/**
 * Policy demo: schedule writes throw, TOPRA stays one aspect,
 * NGSL floor counts match the pack, quest success is must_elicit.
 * Run: npm run demo:policy
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMustElicit, EchoBroker } from "../agents/echo-broker.js";
import { CurriculumDirector } from "../agents/curriculum-director.js";
import { AgentEventLog } from "../agents/event-log.js";
import { EvalSentinel } from "../agents/eval-sentinel.js";
import { MemoryPolicyError, upsertEpisode } from "../agents/learner-memory.js";
import { SchedulePolicyError } from "../agents/policy.js";
import { findRepoRoot } from "../content/paths.js";
import { loadCatalog, loadPackMeta, loadSeedLexemes, readyLexemes } from "../content/loadLexemes.js";
import { loadQuestFromYaml } from "../quest/loadQuest.js";
import { buildPublicPrompts } from "../session/prompts.js";
import { cardIdFor } from "../scheduler/TideScheduler.js";
import { LOCAL_LEARNER_ID } from "../session/open-round.js";
import { join } from "node:path";

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const failures: string[] = [];

function expectThrow(label: string, fn: () => void, ctor: new (...args: never[]) => Error): void {
  try {
    fn();
    failures.push(`${label}: expected throw`);
  } catch (error) {
    if (!(error instanceof ctor)) {
      failures.push(`${label}: wrong error ${error instanceof Error ? error.name : typeof error}`);
    }
  }
}

const seed = loadSeedLexemes(root);
if (seed.length !== 5) failures.push(`seed lexemes ${seed.length} !== 5`);

const catalog = loadCatalog(root);
const meta = loadPackMeta(root);
const pending = catalog.filter((row) => row.enrichment_status === "pending").length;
const touched = catalog.filter(
  (row) => row.enrichment_status === "ready" || row.enrichment_status === "partial",
).length;
if (catalog.length !== 721) failures.push(`catalog ${catalog.length} !== 721`);
if (meta.stats.lemmas !== catalog.length) {
  failures.push(`pack meta lemmas ${meta.stats.lemmas} !== catalog`);
}
if (pending !== meta.stats.enrichment_pending) {
  failures.push(`pending ${pending} !== meta ${meta.stats.enrichment_pending}`);
}
if (touched !== meta.stats.enrichment_touched) {
  failures.push(`touched ${touched} !== meta ${meta.stats.enrichment_touched}`);
}
if (pending < 600) failures.push(`pending ${pending} is too small to be the real floor`);

const prompts = buildPublicPrompts(seed, "form");
const expectedIds = seed.map((lexeme) => cardIdFor(LOCAL_LEARNER_ID, lexeme.id, "form"));
if (prompts.map((prompt) => prompt.card_id).join("|") !== expectedIds.join("|")) {
  failures.push("public prompt card ids drifted from TideScheduler ids");
}
function clozeStillShows(cloze: string, orthography: string): boolean {
  const escaped = orthography.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(cloze);
}

for (const prompt of prompts) {
  const lexeme = seed.find((row) => row.id === prompt.lexeme_id)!;
  if (clozeStillShows(prompt.cloze, lexeme.orthography)) {
    failures.push(`cloze still contains ${lexeme.orthography}`);
  }
}

const readyTop = readyLexemes(catalog).slice(0, 5);
if (readyTop.length < 5) failures.push(`ready lexemes ${readyTop.length} < 5`);
for (const prompt of buildPublicPrompts(readyTop, "form")) {
  const lexeme = readyTop.find((row) => row.id === prompt.lexeme_id)!;
  if (clozeStillShows(prompt.cloze, lexeme.orthography)) {
    failures.push(`NGSL cloze still contains ${lexeme.orthography}`);
  }
}

const log = new AgentEventLog();
const sentinel = new EvalSentinel(log);
const pendingEmptyGloss = catalog.filter(
  (row) => row.enrichment_status === "pending" && !row.gloss_zh.trim(),
).length;
failures.push(
  ...sentinel.runGoldSuite({
    lexeme: seed[0]!,
    quest: loadQuestFromYaml(join(root, "content/quests/echo-bazaar-info-gap-01.yaml")),
    catalogStats: {
      lemmas: catalog.length,
      pending,
      pendingEmptyGloss,
    },
  }),
);

const director = new CurriculumDirector(log);
expectThrow(
  "two aspects",
  () => director.requestException(["en_tide", "en_echo"], ["form", "meaning"]),
  SchedulePolicyError,
);

const quest = loadQuestFromYaml(join(root, "content/quests/echo-bazaar-info-gap-01.yaml"));
const broker = new EchoBroker(log);
const said = "What is the price? May I bargain? The stall closes at sunset.";
const hits = broker.check(quest, said);
if (!hits.every((hit) => hit.hit)) failures.push("english elicit should hit every must_elicit");
const quiet = checkMustElicit(quest, "你好，这个多少钱");
if (quiet.some((hit) => hit.hit)) failures.push("Chinese-only text must not satisfy must_elicit");
const deal = broker.finalizeDeal(quest, hits, 3);
if (!deal.success) failures.push(deal.reason);
const early = broker.finalizeDeal(quest, quiet, 1);
if (early.success) failures.push("finalizeDeal succeeded without must_elicit");

expectThrow(
  "memory dump",
  () => upsertEpisode(log, { kind: "episode", text: "x".repeat(400) }),
  MemoryPolicyError,
);

if (failures.length > 0) {
  console.error("Policy failures:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `NGSL-S lemmas=${catalog.length} ready/partial=${touched} pending=${pending} forms=${meta.stats.forms}`,
);
console.log(`Quest ${quest.id} must_elicit checked in code.`);
console.log(`agent_runs=${log.runs.length} eval_scores=${log.evalScores.length} events=${log.events.length}`);
console.log("Policy OK.");
