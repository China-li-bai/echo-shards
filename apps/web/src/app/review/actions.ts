"use server";

import { AgentEventLog, ForgeSmith, type Grade } from "@echo-shards/core";
import { findReviewLexeme } from "@/lib/content";

export interface FormReveal {
  suggested: Grade;
  orthography: string;
  phonetic_text: string;
  example_sentence: string;
  example_sentence_zh: string;
  gloss_zh: string;
}

/** Forge Smith suggests a grade. It does not touch due. */
export async function suggestFormGrade(lexemeId: string, typed: string): Promise<FormReveal> {
  const lexeme = findReviewLexeme(lexemeId);
  if (!lexeme) {
    throw new Error(`这张卡不在可复习的已审校词里：${lexemeId}`);
  }
  const smith = new ForgeSmith(new AgentEventLog());
  smith.lockAspect("form");
  const suggested = smith.gradeAttempt("form", lexeme.orthography, typed);
  return {
    suggested,
    orthography: lexeme.orthography,
    phonetic_text: lexeme.phonetic_text,
    example_sentence: lexeme.example_sentence,
    example_sentence_zh: lexeme.example_sentence_zh ?? "",
    gloss_zh: lexeme.gloss_zh,
  };
}
