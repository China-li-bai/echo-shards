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
  expected: string;
}

function expectedFor(aspect: Aspect, lexeme: {
  gloss_zh: string;
  orthography: string;
  phonetic_text: string;
}): { value: string; label: string } {
  if (aspect === "meaning") return { value: lexeme.gloss_zh, label: "中文义" };
  if (aspect === "phonology_text") {
    return { value: lexeme.phonetic_text, label: "文字音标（IPA）" };
  }
  return { value: lexeme.orthography, label: "词形" };
}

/** Forge Smith suggests a grade. It does not touch due. */
export async function suggestAspectGrade(
  lexemeId: string,
  typed: string,
  aspect: Aspect = "form",
): Promise<AspectReveal> {
  const lexeme = findReviewLexeme(lexemeId);
  if (!lexeme) {
    throw new Error(`这张卡不在可练的已审校词里：${lexemeId}`);
  }
  if (aspect === "meaning" && !lexeme.gloss_zh.trim()) {
    throw new Error("这个词还没有中文义，暂时不能练意思。");
  }
  if (aspect === "phonology_text" && !lexeme.phonetic_text.trim()) {
    throw new Error("这个词还没有音标，暂时不能练读音。");
  }
  const smith = new ForgeSmith(new AgentEventLog());
  smith.lockAspect(aspect);
  const { value: expected, label } = expectedFor(aspect, lexeme);
  const suggested = smith.gradeAttempt(aspect, expected, typed);
  return {
    suggested,
    aspect,
    orthography: lexeme.orthography,
    phonetic_text: lexeme.phonetic_text,
    example_sentence: lexeme.example_sentence,
    example_sentence_zh: lexeme.example_sentence_zh ?? "",
    gloss_zh: lexeme.gloss_zh,
    expected_label: label,
    expected,
  };
}

/** @deprecated use suggestAspectGrade */
export async function suggestFormGrade(lexemeId: string, typed: string) {
  return suggestAspectGrade(lexemeId, typed, "form");
}

export type FormReveal = AspectReveal;
