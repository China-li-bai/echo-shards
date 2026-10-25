/**
 * 言灵残片 · 文字侧核心数据模型
 * TOPRA：每个 (lexeme × aspect) 独立一条 FSRS 卡；音界本阶段仅文字音标。
 */

import { z } from "zod";

/** 三界分铸三轮：形 / 义 / 音(文字) */
export const AspectSchema = z.enum(["form", "meaning", "phonology_text"]);
export type Aspect = z.infer<typeof AspectSchema>;

/** 词条：形·音文字·义；无音频字段 */
export const LexemeSchema = z.object({
  id: z.string().min(1),
  lemma: z.string().min(1),
  orthography: z.string().min(1),
  /** IPA / 拼音等文字表征；本阶段禁止音频 URL */
  phonetic_text: z.string().min(1),
  gloss_zh: z.string().min(1),
  sense_id: z.string().min(1),
  example_sentence: z.string().min(1),
  example_sentence_zh: z.string().optional(),
  collocations: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  freq_rank: z.number().int().positive().optional(),
  lang: z.string().default("en"),
  l1: z.string().default("zh"),
});
export type Lexeme = z.infer<typeof LexemeSchema>;

/** NGSL 地板行：pending 义项允许空 gloss / 音标，禁止把空串当成已审校释义。 */
export const EnrichmentStatusSchema = z.enum([
  "pending",
  "partial",
  "ready",
  "blocked",
]);
export type EnrichmentStatus = z.infer<typeof EnrichmentStatusSchema>;

export const CatalogLexemeSchema = z.object({
  id: z.string().min(1),
  lemma: z.string().min(1),
  orthography: z.string().min(1),
  phonetic_text: z.string(),
  gloss_zh: z.string(),
  sense_id: z.string().min(1),
  example_sentence: z.string(),
  example_sentence_zh: z.string().optional(),
  collocations: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable().optional(),
  freq_rank: z.number().int().positive().nullable().optional(),
  lang: z.string().default("en"),
  l1: z.string().default("zh"),
  lemma_id: z.string().optional(),
  enrichment_status: EnrichmentStatusSchema.default("pending"),
  source_pack_id: z.string().nullable().optional(),
  gloss_en: z.string().nullable().optional(),
  license_note: z.string().nullable().optional(),
});
export type CatalogLexeme = z.infer<typeof CatalogLexemeSchema>;

/**
 * FSRS Card 对齐字段（ts-fsrs Card）
 * 每个 (user × lexeme × aspect) 一条独立调度轨
 */
export const ReviewStateSchema = z.object({
  state: z.number().int(), // State: New=0 Learning=1 Review=2 Relearning=3
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number().int(),
  lapses: z.number().int(),
  learning_steps: z.number().int().optional(),
  last_review: z.coerce.date().optional(),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  lexeme_id: z.string().min(1),
  aspect: AspectSchema,
  review: ReviewStateSchema,
});
export type Card = z.infer<typeof CardSchema>;

/** 单次会话批次：约 5 词，一轮只聚焦一个 aspect */
export const SessionBatchSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  aspect: AspectSchema,
  lexeme_ids: z.array(z.string()).min(1).max(8),
  card_ids: z.array(z.string()).min(1),
  created_at: z.coerce.date(),
});
export type SessionBatch = z.infer<typeof SessionBatchSchema>;

/** 回声交易所·文字版信息差任务 */
export const QuestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  roles: z.object({
    student: z.string().min(1),
    npc: z.string().min(1),
  }),
  student_knows: z.array(z.string()).min(1),
  npc_knows: z.array(z.string()).min(1),
  /** 学生必须主动问出的信息点（信息差强制产出） */
  must_elicit: z.array(z.string()).min(1),
  success_criteria: z.array(z.string()).min(1),
  target_lexemes: z.array(z.string()).default([]),
  max_turns: z.number().int().positive().default(12),
  rubric: z.string().min(1),
  modality: z.literal("text").default("text"),
});
export type Quest = z.infer<typeof QuestSchema>;

/** 营地进度占位：XP / 残片 / 营地等级 */
export const ProgressSchema = z.object({
  user_id: z.string().min(1),
  xp: z.number().int().nonnegative().default(0),
  shards: z.number().int().nonnegative().default(0),
  camp_level: z.number().int().positive().default(1),
  streak_days: z.number().int().nonnegative().default(0),
  updated_at: z.coerce.date(),
});
export type Progress = z.infer<typeof ProgressSchema>;

/** 复习评分：对齐 ts-fsrs Rating（1–4） */
export const GradeSchema = z.union([
  z.literal(1), // Again
  z.literal(2), // Hard
  z.literal(3), // Good
  z.literal(4), // Easy
]);
export type Grade = z.infer<typeof GradeSchema>;

export const ReviewLogSchema = z.object({
  id: z.string().min(1),
  card_id: z.string().min(1),
  user_id: z.string().min(1),
  grade: GradeSchema,
  reviewed_at: z.coerce.date(),
  state_before: z.number().int(),
  scheduled_days: z.number().optional(),
});
export type ReviewLog = z.infer<typeof ReviewLogSchema>;
