/**
 * Validate all static Quest YAML files under content/quests/.
 * Run: npm run demo:quest
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadQuestFromYaml } from "../quest/loadQuest.js";
import { findRepoRoot } from "../content/paths.js";

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "content/quests");
const files = readdirSync(dir).filter((name) => name.endsWith(".yaml")).sort();
if (files.length < 2) {
  console.error(`expected ≥2 static quests, found ${files.length}`);
  process.exit(1);
}
for (const name of files) {
  const quest = loadQuestFromYaml(join(dir, name));
  console.log(`OK ${quest.id} · must_elicit=${quest.must_elicit.length} · ${quest.title}`);
}
console.log(`\nQuest YAML → Zod OK (${files.length} files).`);
