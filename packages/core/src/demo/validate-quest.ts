/**
 * 单独校验 Quest YAML
 * 运行：npm run demo:quest
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadQuestFromYaml } from "../quest/loadQuest.js";
import { findRepoRoot } from "../content/paths.js";

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const quest = loadQuestFromYaml(
  join(root, "content/quests/echo-bazaar-info-gap-01.yaml"),
);
console.log(JSON.stringify(quest, null, 2));
console.log("\nQuest YAML → Zod OK.");
