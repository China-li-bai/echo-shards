/**
 * Eval Sentinel gold suite + deal rate.
 * Run: npm run demo:eval
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentEventLog } from "../agents/event-log.js";
import { EchoBroker } from "../agents/echo-broker.js";
import { EvalSentinel } from "../agents/eval-sentinel.js";
import { LearnerMemory, MemoryPolicyError } from "../agents/learner-memory.js";
import { findRepoRoot } from "../content/paths.js";
import {
  loadCatalog,
  loadPackMeta,
  loadSeedLexemes,
} from "../content/loadLexemes.js";
import { loadQuestFromYaml } from "../quest/loadQuest.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { FileEventStore, resolveDataDir } from "../persist/file-store.js";
import { composeAdaptTurn } from "../agents/echo-broker.js";

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const failures: string[] = [];

const seed = loadSeedLexemes(root);
const catalog = loadCatalog(root);
const meta = loadPackMeta(root);
const pendingRows = catalog.filter((row) => row.enrichment_status === "pending");
const pendingEmptyGloss = pendingRows.filter((row) => !row.gloss_zh.trim()).length;

const quest = loadQuestFromYaml(join(root, "content/quests/echo-bazaar-info-gap-01.yaml"));
const log = new AgentEventLog();
const sentinel = new EvalSentinel(log);
const broker = new EchoBroker(log);
const memory = new LearnerMemory(log);

failures.push(
  ...sentinel.runGoldSuite({
    lexeme: seed[0]!,
    quest,
    catalogStats: {
      lemmas: catalog.length,
      pending: pendingRows.length,
      pendingEmptyGloss,
    },
  }),
);

const generated = broker.draftQuest({
  lexemes: seed,
  id: "generated-seed-echo-bazaar",
  title: "动态市集 · seed 五词",
});
const outDir = join(root, "content/quests/generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${generated.id}.json`), `${JSON.stringify(generated, null, 2)}\n`);

const hits = broker.check(
  generated,
  `Can I bargain for the tide shard? I heard an echo. Please elicit the price before sunset.`,
);
const dealHits = hits.filter((hit) => hit.hit).length;
sentinel.scoreDealRate({
  suite: "generated-quest",
  hits: dealHits,
  total: hits.length,
  item_id: generated.id,
});
const deal = broker.finalizeDeal(generated, hits, 2);
if (!deal.success && dealHits === hits.length) {
  failures.push(`generated quest finalize failed: ${deal.reason}`);
}

try {
  memory.upsertEpisode({
    kind: "episode",
    text: "day=accepted v-form-quest; weak=bargain form",
  });
} catch (error) {
  failures.push(`memory short episode failed: ${String(error)}`);
}
try {
  memory.upsertEpisode({ kind: "episode", text: "x".repeat(400) });
  failures.push("memory dump should throw");
} catch (error) {
  if (!(error instanceof MemoryPolicyError)) {
    failures.push(`memory dump wrong error ${String(error)}`);
  }
}

if (meta.stats.lemmas !== 721) failures.push(`meta lemmas ${meta.stats.lemmas}`);
if (pendingEmptyGloss !== pendingRows.length) {
  failures.push("pending rows must keep empty gloss_zh");
}

const quietHits = broker.check(quest, "你好");
const nudge = composeAdaptTurn(quest, quietHits, 1);
if (!nudge.includes("还缺")) failures.push(`adaptTurn miss nudge: ${nudge}`);
broker.adaptTurn(quest, quietHits, 1);

if (failures.length > 0) {
  console.error("Eval failures:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("=== 言灵残片 · Eval Sentinel Demo ===\n");
console.log(`gold pass · lemmas=${catalog.length} pending=${pendingRows.length} empty_gloss=${pendingEmptyGloss}`);
console.log(`generated quest ${generated.id} written under content/quests/generated/`);
console.log(`deal_rate events=${log.evalScores.filter((row) => row.metric === "deal_rate").length}`);
console.log(`memory items=${memory.items.length}`);
console.log(`agent_runs=${log.runs.length} eval_scores=${log.evalScores.length} events=${log.events.length}`);
const store = new FileEventStore({ dataDir: resolveDataDir(root) });
const snapPath = store.appendSnapshot("demo-events", log.snapshot());
const progress = store.syncProgressFrom("demo-events");
console.log(`persisted: ${snapPath}`);
console.log(
  `progress: xp=${progress.xp} shards=${progress.shards} streak=${progress.streak_days} sessions=${progress.session_count}`,
);
console.log("Eval OK.");
