/**
 * 文字 Quest 加载与校验（YAML → Zod）
 * 强制信息差：must_elicit / student_knows / npc_knows 均不可空。
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { QuestSchema, type Quest } from "../models/types.js";

export function loadQuestFromYaml(filePath: string): Quest {
  const raw = readFileSync(filePath, "utf8");
  const data = parseYaml(raw);
  return QuestSchema.parse(data);
}

export function validateQuestObject(data: unknown): Quest {
  return QuestSchema.parse(data);
}
