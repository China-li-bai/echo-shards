/**
 * Forge Smith — locks one aspect and builds a text retrieval item.
 * assistGrade returns a grade enum only. It does not schedule.
 */

import type { Aspect, Grade, Lexeme } from "../models/types.js";
import { AgentEventLog } from "./event-log.js";
import { assertNoScheduleFields, assertSingleAspect, SchedulePolicyError } from "./policy.js";

export interface RetrievalItem {
  card_id: string;
  lexeme_id: string;
  aspect: Aspect;
  prompt: string;
  cloze: string;
  /** Server-side only. Do not ship this to the browser before reveal. */
  expected: string;
}

export function blankOrthography(sentence: string, orthography: string): string {
  if (!sentence.trim()) return "____";
  const escaped = orthography.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bounded = new RegExp(`\\b${escaped}\\b`, "gi");
  const next = sentence.replace(bounded, "____");
  if (next !== sentence) return next;
  const loose = sentence.replace(new RegExp(escaped, "gi"), "____");
  return loose === sentence ? `${sentence}  ____` : loose;
}

export function editDistance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = current;
    }
  }
  return dp[b.length]!;
}

function meaningMatch(expected: string, typed: string): boolean {
  const norm = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  const guess = norm(typed);
  if (!guess) return false;
  const parts = expected
    .split(/[;；、,，/]/)
    .map(norm)
    .filter((part) => part.length > 0);
  return parts.some((part) => part.includes(guess) || guess.includes(part));
}

export function assistGrade(aspect: Aspect, expected: string, typed: string): Grade {
  const guess = typed.trim();
  if (!guess) return 1;
  if (aspect === "meaning") return meaningMatch(expected, guess) ? 3 : 1;
  const normalize =
    aspect === "phonology_text"
      ? (value: string) => value.replace(/[/\s]/g, "").toLowerCase()
      : (value: string) => value.trim().toLowerCase();
  const left = normalize(guess);
  const right = normalize(expected);
  if (left === right) return 3;
  if (editDistance(left, right) === 1) return 2;
  return 1;
}

export class ForgeSmith {
  private locked: Aspect | null = null;

  constructor(private readonly log: AgentEventLog) {}

  get lockedAspect(): Aspect | null {
    return this.locked;
  }

  lockAspect(aspect: Aspect): Aspect {
    assertSingleAspect([aspect]);
    if (this.locked && this.locked !== aspect) {
      const message = `Forge Smith already locked ${this.locked}; refusing to open ${aspect} in the same batch.`;
      this.log.recordRun({
        agent: "forge_smith",
        tools: ["lockAspect"],
        status: "blocked",
        error_message: message,
      });
      throw new SchedulePolicyError(message);
    }
    this.locked = aspect;
    this.log.recordRun({
      agent: "forge_smith",
      tools: ["lockAspect"],
      status: "ok",
      output_ref: aspect,
    });
    return aspect;
  }

  genRetrievalItem(lexeme: Lexeme, cardId: string, aspect: Aspect): RetrievalItem {
    if (this.locked !== aspect) {
      throw new SchedulePolicyError(
        `Forge Smith expected locked aspect ${this.locked ?? "(none)"}, got ${aspect}.`,
      );
    }
    const item = itemFor(lexeme, cardId, aspect);
    assertNoScheduleFields(item, "forge_smith");
    this.log.recordRun({
      agent: "forge_smith",
      tools: ["genRetrievalItem"],
      status: "ok",
      input_ref: lexeme.id,
      output_ref: aspect,
    });
    return item;
  }

  gradeAttempt(aspect: Aspect, expected: string, typed: string): Grade {
    if (this.locked && this.locked !== aspect) {
      throw new SchedulePolicyError(
        `assistGrade refused: batch is locked to ${this.locked}.`,
      );
    }
    const grade = assistGrade(aspect, expected, typed);
    const payload = { grade };
    assertNoScheduleFields(payload, "forge_smith");
    this.log.recordRun({
      agent: "forge_smith",
      tools: ["assistGrade"],
      status: "ok",
      output_ref: `grade=${grade}`,
    });
    return grade;
  }

  /** Other surface forms from this batch only — never invented glosses. */
  suggestDistractors(correct: string, pool: readonly string[], limit = 3): string[] {
    const seen = new Set<string>();
    const distractors: string[] = [];
    for (const raw of pool) {
      const value = raw.trim();
      const key = value.toLowerCase();
      if (!value || key === correct.trim().toLowerCase() || seen.has(key)) continue;
      seen.add(key);
      distractors.push(value);
      if (distractors.length >= limit) break;
    }
    this.log.recordRun({
      agent: "forge_smith",
      tools: ["suggestDistractors"],
      status: "ok",
      output_ref: String(distractors.length),
    });
    return distractors;
  }
}

function itemFor(lexeme: Lexeme, cardId: string, aspect: Aspect): RetrievalItem {
  if (aspect === "form") {
    return {
      card_id: cardId,
      lexeme_id: lexeme.id,
      aspect,
      prompt: "看中文义和挖空例句，拼出英文词。",
      cloze: blankOrthography(lexeme.example_sentence, lexeme.orthography),
      expected: lexeme.orthography,
    };
  }
  if (aspect === "meaning") {
    return {
      card_id: cardId,
      lexeme_id: lexeme.id,
      aspect,
      prompt: "看英文词，写出中文义。",
      cloze: lexeme.orthography,
      expected: lexeme.gloss_zh,
    };
  }
  return {
    card_id: cardId,
    lexeme_id: lexeme.id,
    aspect,
    prompt: "看英文词，写出文字音标（本阶段不评分音频）。",
    cloze: lexeme.orthography,
    expected: lexeme.phonetic_text,
  };
}
