/**
 * FS-free catalog helpers — safe to import from the Next/Workers web app.
 * Loaders that read disk live in loadLexemes.ts (Node demos / scripts).
 */

import { z } from "zod";
import {
  CatalogLexemeSchema,
  LexemeSchema,
  type CatalogLexeme,
  type Lexeme,
} from "../models/types.js";

export const PackMetaSchema = z.object({
  pack: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    license: z.string(),
    source_url: z.string().optional(),
    mirror_url: z.string().optional(),
    citation: z.string().optional(),
    coverage_note: z.string().optional(),
    lemma_count: z.number().optional(),
  }),
  imported_at: z.string().optional(),
  stats: z.object({
    lemmas: z.number(),
    senses: z.number(),
    forms: z.number(),
    enrichment_touched: z.number(),
    enrichment_pending: z.number(),
  }),
});
export type PackMetaFile = z.infer<typeof PackMetaSchema>;

/** Ready rows only. Empty glosses are not coerced into Lexeme. */
export function readyLexemes(rows: CatalogLexeme[]): Lexeme[] {
  const ready = rows.filter(
    (row) =>
      row.enrichment_status === "ready" &&
      row.gloss_zh.trim() &&
      row.phonetic_text.trim() &&
      row.example_sentence.trim(),
  );
  return LexemeSchema.array().parse(ready);
}

export function parseSeedLexemes(raw: unknown): Lexeme[] {
  return LexemeSchema.array().parse(raw);
}

export function parseCatalog(raw: unknown): CatalogLexeme[] {
  return CatalogLexemeSchema.array().parse(raw);
}

export function parsePackMeta(raw: unknown): PackMetaFile {
  return PackMetaSchema.parse(raw);
}
