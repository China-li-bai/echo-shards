/**
 * Read seed lexemes and the NGSL-S catalog from content/.
 * Pending rows stay pending — this loader never fills glosses.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  CatalogLexemeSchema,
  LexemeSchema,
  type CatalogLexeme,
  type Lexeme,
} from "../models/types.js";
import { contentPath, findRepoRoot } from "./paths.js";

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

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function loadSeedLexemes(root: string = findRepoRoot()): Lexeme[] {
  const raw = readJson(contentPath(root, "lexemes", "seed-en-zh-5.json"));
  return LexemeSchema.array().parse(raw);
}

export function loadCatalog(root: string = findRepoRoot()): CatalogLexeme[] {
  const raw = readJson(
    contentPath(root, "lexemes", "ngsl-s-1.2-lexemes-seed.json"),
  );
  return CatalogLexemeSchema.array().parse(raw);
}

export function loadPackMeta(root: string = findRepoRoot()): PackMetaFile {
  const raw = readJson(
    join(root, "content", "packs", "ngsl-s-1.2", "pack.meta.json"),
  );
  return PackMetaSchema.parse(raw);
}

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
