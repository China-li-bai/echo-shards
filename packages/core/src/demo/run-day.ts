/**
 * Day plan demo: Curriculum Director proposes 2–3 variants under load ≤5.
 * Run: npm run demo:day
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CurriculumDirector } from "../agents/curriculum-director.js";
import { AgentEventLog } from "../agents/event-log.js";
import { findRepoRoot } from "../content/paths.js";
import { loadSeedLexemes } from "../content/loadLexemes.js";
import { dayIdShanghai } from "../format.js";
import { ASPECT_LABEL } from "../format.js";

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const seed = loadSeedLexemes(root);
const now = new Date();
const dayId = dayIdShanghai(now);
const log = new AgentEventLog();
const director = new CurriculumDirector(log);

const intent = "今天练拼写，顺带去市集把词问出来";
const proposal = director.proposeDayPlan({
  lexemeIds: seed.map((row) => row.id),
  now,
  intent,
  questId: "echo-bazaar-info-gap-01",
});

console.log("=== 言灵残片 · 日课提案 Demo ===\n");
console.log(`dayId (Asia/Shanghai): ${dayId}`);
console.log(`intent: ${proposal.intent}`);
console.log(`proposal: ${proposal.id}  status=${proposal.status}`);
console.log(
  `load_estimate: max_lexemes=${proposal.load_estimate.max_lexemes} aspects=${proposal.load_estimate.aspects}`,
);
console.log(`variants (${proposal.variants.length}):`);
for (const variant of proposal.variants) {
  console.log(
    `  - ${variant.id}  ${ASPECT_LABEL[variant.aspect]}  load=${variant.load}  ` +
      `${variant.label}` +
      (variant.include_quest ? `  quest=${variant.quest_id}` : ""),
  );
  console.log(`    lexemes: ${variant.lexeme_ids.join(", ")}`);
}

const chosen = director.accept(proposal.id, "v-form-quest");
console.log(`\naccepted: ${chosen.id} aspect=${chosen.aspect} include_quest=${Boolean(chosen.include_quest)}`);
console.log(
  `events: intent=${log.events.filter((e) => e.event_type === "intent").length} ` +
    `proposal_accepted=${log.events.filter((e) => e.event_type === "proposal_accepted").length}`,
);
console.log(`agent_runs=${log.runs.length} proposals=${log.proposals.length}`);
console.log("Demo day OK.");
