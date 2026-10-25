/**
 * Public prompts omit the expected answer so a form round can hide spelling
 * until Forge Smith reveals it. Meaning rounds hide gloss_zh.
 * Phonology_text rounds hide phonetic_text (text IPA only; no audio).
 */

import type { Aspect, Lexeme } from "../models/types.js";
import { AgentEventLog } from "../agents/event-log.js";
import type { RetrievalItem } from "../agents/forge-smith.js";
import { TideScheduler } from "../scheduler/TideScheduler.js";
import { LOCAL_LEARNER_ID, openAspectRound } from "./open-round.js";

export interface PublicPrompt {
  card_id: string;
  lexeme_id: string;
  aspect: Aspect;
  prompt: string;
  cloze: string;
  /** Hidden for meaning aspect so the answer is not leaked. */
  gloss_zh: string;
  orthography_hint?: string;
  cefr?: string;
  freq_rank?: number;
}

const PUBLIC_KEYS = [
  "card_id",
  "lexeme_id",
  "aspect",
  "prompt",
  "cloze",
  "gloss_zh",
  "orthography_hint",
  "cefr",
  "freq_rank",
] as const;

export function toPublicPrompt(item: RetrievalItem, lexeme: Lexeme): PublicPrompt {
  const hideGloss = item.aspect === "meaning";
  const showOrthoHint =
    item.aspect === "meaning" || item.aspect === "phonology_text";
  const prompt: PublicPrompt = {
    card_id: item.card_id,
    lexeme_id: item.lexeme_id,
    aspect: item.aspect,
    prompt: item.prompt,
    cloze: item.cloze,
    gloss_zh: hideGloss ? "" : lexeme.gloss_zh,
    orthography_hint: showOrthoHint ? lexeme.orthography : undefined,
    cefr: lexeme.cefr,
    freq_rank: lexeme.freq_rank,
  };
  return prompt;
}

export function assertPublicPrompt(value: PublicPrompt): void {
  const keys = Object.keys(value).filter((key) => value[key as keyof PublicPrompt] !== undefined);
  for (const key of keys) {
    if (!PUBLIC_KEYS.includes(key as (typeof PUBLIC_KEYS)[number])) {
      throw new Error(`Public prompt leaked field ${key}`);
    }
  }
  if ("expected" in value) {
    throw new Error("Public prompt contains the answer");
  }
  if (value.aspect === "form" && "orthography" in value) {
    throw new Error("Public prompt contains the answer");
  }
}

export function buildPublicPrompts(
  lexemes: Lexeme[],
  aspect: Aspect = "form",
  now: Date = new Date("2026-10-25T01:00:00.000Z"),
): PublicPrompt[] {
  const round = openAspectRound({
    tide: new TideScheduler({ requestRetention: 0.9 }),
    log: new AgentEventLog(),
    lexemes,
    userId: LOCAL_LEARNER_ID,
    aspect,
    now,
  });
  return round.items.map((item) => {
    const lexeme = lexemes.find((row) => row.id === item.lexeme_id);
    if (!lexeme) throw new Error(`Missing lexeme ${item.lexeme_id}`);
    const prompt = toPublicPrompt(item, lexeme);
    assertPublicPrompt(prompt);
    if (aspect === "form") {
      const visible = `${prompt.cloze}\n${prompt.gloss_zh}\n${prompt.prompt}`.toLowerCase();
      if (visible.includes(item.expected.toLowerCase())) {
        throw new Error(`Form prompt still shows ${item.expected}`);
      }
    }
    if (aspect === "meaning") {
      const visible = `${prompt.cloze}\n${prompt.gloss_zh}\n${prompt.prompt}`.toLowerCase();
      const glossParts = item.expected
        .split(/[;；、,，/]/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
      for (const part of glossParts) {
        if (part.length >= 2 && visible.includes(part)) {
          throw new Error(`Meaning prompt still shows gloss ${part}`);
        }
      }
    }
    if (aspect === "phonology_text") {
      const visible = `${prompt.cloze}\n${prompt.gloss_zh}\n${prompt.prompt}`.toLowerCase();
      const phon = item.expected.replace(/[\/\s]/g, "").toLowerCase();
      if (phon.length >= 2 && visible.replace(/[\/\s]/g, "").includes(phon)) {
        throw new Error(`Phonology prompt still shows ${item.expected}`);
      }
    }
    return prompt;
  });
}
