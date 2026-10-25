/**
 * FS-free quest parsers — safe for Next/Workers bundling.
 */

import { parse as parseYaml } from "yaml";
import { QuestSchema, type Quest } from "../models/types.js";

/** Parse quest YAML text (string may be imported as a bundled asset). */
export function parseQuestYaml(raw: string): Quest {
  return QuestSchema.parse(parseYaml(raw));
}

export function validateQuestObject(data: unknown): Quest {
  return QuestSchema.parse(data);
}
