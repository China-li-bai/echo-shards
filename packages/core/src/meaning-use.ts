/**
 * Form-only check that a sentence contains a target word.
 *
 * This is the 会用 track, separate from FSRS 记得. It does not schedule,
 * unlock, or score meaning. Quest must_elicit stays in echo-broker and is
 * not reused here: that helper matches long Latin substrings, which would
 * treat "catch" as "cat".
 *
 * A later model or human review would be a different function. This module
 * does not pretend to do that review. The review page does not call this yet.
 */

const MAX_SENTENCE = 240;

const NOTE = {
  basic_form_ok: "这句话里有这个词。意思用得对不对，还没判断。",
  empty: "先写一句再看。",
  chinese_only: "这句还是中文。用英文把这个词写进去。",
  target_missing: "这句里还没有这个词。",
  target_inside_other_word: "看到了很像的拼写，但还不是这个词。",
  token_only: "只重复这个词还不算用上。再写几个别的词。",
  no_words: "先用英文写一句，把这个词放进去。",
  overlong: "这句太长了，这次先不看。",
  unknown_target: "还不知道要看哪个词。",
  not_ready: "这个词还没准备好，先不拿来练。",
} as const;

export type MeaningUseReason = keyof typeof NOTE;

export type MeaningUseVerdict = "basic_pass" | "basic_fail" | "not_assessable";

export interface MeaningUseInput {
  lemma: string;
  /** Surface forms that may count. No stemmer is applied. */
  forms?: readonly string[];
  sentence: string;
  /** When set to anything other than ready, the word is not checked. */
  enrichment_status?: "pending" | "partial" | "ready" | "blocked" | string;
}

export interface MeaningUseResult {
  verdict: MeaningUseVerdict;
  reasons: MeaningUseReason[];
  learner_note: string;
  /** Always false. This function does not judge whether the meaning fits. */
  meaning_judged: false;
  semantic_status: "not_evaluated";
  /** Remembering stays on its own track. This name is not that track. */
  event_type: "meaning_use";
}

function result(verdict: MeaningUseVerdict, reason: MeaningUseReason): MeaningUseResult {
  return {
    verdict,
    reasons: [reason],
    learner_note: NOTE[reason],
    meaning_judged: false,
    semantic_status: "not_evaluated",
    event_type: "meaning_use",
  };
}

function wordShape(value: string): string | null {
  const token = value.trim().toLowerCase();
  if (!/^[a-z]+(?:'[a-z]+)?$/.test(token)) return null;
  return token;
}

function latinTokens(sentence: string): string[] {
  return sentence.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function hasCjk(sentence: string): boolean {
  return /[\u3400-\u9fff]/.test(sentence);
}

/**
 * Confirm only that the sentence meets basic form conditions.
 * basic_pass does not mean the sentence is appropriate, grammatical, or learned.
 */
export function checkMeaningUse(input: MeaningUseInput): MeaningUseResult {
  const lemma = typeof input?.lemma === "string" ? wordShape(input.lemma) : null;
  if (!lemma) return result("not_assessable", "unknown_target");
  if (input.enrichment_status !== undefined && input.enrichment_status !== "ready") {
    return result("not_assessable", "not_ready");
  }
  if (typeof input.sentence !== "string") return result("not_assessable", "unknown_target");
  if (input.sentence.trim() === "") return result("basic_fail", "empty");
  if (input.sentence.length > MAX_SENTENCE) return result("not_assessable", "overlong");

  const accepted = new Set<string>([lemma]);
  for (const form of input.forms ?? []) {
    if (typeof form !== "string") continue;
    const token = wordShape(form);
    if (token) accepted.add(token);
  }

  const tokens = latinTokens(input.sentence);
  if (tokens.length === 0) {
    return result("basic_fail", hasCjk(input.sentence) ? "chinese_only" : "no_words");
  }

  const hits = tokens.filter((token) => accepted.has(token));
  if (hits.length === 0) {
    const inside = tokens.some((token) => [...accepted].some((form) => form.length > 0 && token.includes(form)));
    return result("basic_fail", inside ? "target_inside_other_word" : "target_missing");
  }
  const hasOtherWord = tokens.some((token) => !accepted.has(token));
  if (!hasOtherWord) return result("basic_fail", "token_only");
  return result("basic_pass", "basic_form_ok");
}
