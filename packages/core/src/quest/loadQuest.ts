/**
 * 文字 Quest 加载与校验（YAML → Zod）via node:fs.
 * For Workers, import YAML as a module string and use parseQuestYaml.
 */

import { readFileSync } from "node:fs";
import { parseQuestYaml, validateQuestObject } from "./parseQuest.js";
import type { Quest } from "../models/types.js";

export { parseQuestYaml, validateQuestObject };

export function loadQuestFromYaml(filePath: string): Quest {
  return parseQuestYaml(readFileSync(filePath, "utf8"));
}
