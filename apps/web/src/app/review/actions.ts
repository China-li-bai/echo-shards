"use server";

import { AgentEventLog, ForgeSmith, type Aspect, type Grade } from "@echo-shards/core";
import { findReviewLexeme } from "@/lib/content";

export interface AspectReveal {
  suggested: Grade;
  aspect: Aspect;
  orthography: string;
  phonetic_text: string;
  example_sentence: string;
  example_sentence_zh: string;
  gloss_zh: string;
  expected_label: string;
}

/** Forge Smith suggests a grade. It does not touch due. */
export async function suggestAspectGrade(
  lexemeId: string,
  typed: string,
  aspect: Aspect = "form",
): Promise<AspectReveal> {
  const lexeme = findReviewLexeme(lexemeId);
  if (!lexeme) {
    throw new Error(`这张卡不在可复习的已审校词里：${lexemeId}`);
  }
  if (aspect === "meaning" && !lexeme.gloss_zh.trim()) {
    throw new Error("待审校词没有中文义，不能开义界。");
  }
  const smith = new ForgeSmith(new AgentEventLog());
  smith.lockAspect(aspect);
  const expected = aspect === "meaning" ? lexeme.gloss_zh : lexeme.orthography;
  const suggested = smith.gradeAttempt(aspect, expected, typed);
  return {
    suggested,
    aspect,
    orthography: lexeme.orthography,
    phonetic_text: lexeme.phonetic_text,
    example_sentence: lexeme.example_sentence,
    example_sentence_zh: lexeme.example_sentence_zh ?? "",
    gloss_zh: lexeme.gloss_zh,
    expected_label: aspect === "meaning" ? "中文义" : "词形",
  };
}

/** @deprecated use suggestAspectGrade */
export async function suggestFormGrade(lexemeId: string, typed: string) {
  return suggestAspectGrade(lexemeId, typed, "form");
}

export type FormReveal = AspectReveal;
