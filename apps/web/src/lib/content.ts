import { join } from "node:path";
import {
  buildPublicPrompts,
  type CatalogLexeme,
  type PublicPrompt,
  type Quest,
} from "@echo-shards/core";
import {
  findRepoRoot,
  loadCatalog,
  loadPackMeta,
  loadQuestFromYaml,
  loadSeedLexemes,
  readyLexemes,
  type PackMetaFile,
} from "@echo-shards/core/node";

export type PoolId = "seed" | "ngsl";

export interface ReviewPool {
  id: PoolId;
  title: string;
  detail: string;
  prompts: PublicPrompt[];
}

export interface FloorSummary {
  meta: PackMetaFile;
  counts: {
    lemmas: number;
    ready: number;
    partial: number;
    pending: number;
    forms: number;
  };
}

export interface LexemeRow {
  id: string;
  lemma: string;
  freq_rank: number | null;
  enrichment_status: CatalogLexeme["enrichment_status"];
  gloss_zh: string;
  gloss_en: string | null;
  phonetic_text: string;
  cefr: string | null;
}

let repoRoot: string | null = null;
let catalogCache: CatalogLexeme[] | null = null;

function root(): string {
  repoRoot ??= findRepoRoot();
  return repoRoot;
}

function catalog(): CatalogLexeme[] {
  catalogCache ??= loadCatalog(root());
  return catalogCache;
}

export function getFloorSummary(): FloorSummary {
  const meta = loadPackMeta(root());
  const rows = catalog();
  return {
    meta,
    counts: {
      lemmas: rows.length,
      ready: rows.filter((row) => row.enrichment_status === "ready").length,
      partial: rows.filter((row) => row.enrichment_status === "partial").length,
      pending: rows.filter((row) => row.enrichment_status === "pending").length,
      forms: meta.stats.forms,
    },
  };
}

export function getLexemeRows(): LexemeRow[] {
  return catalog().map((row) => ({
    id: row.id,
    lemma: row.lemma,
    freq_rank: row.freq_rank ?? null,
    enrichment_status: row.enrichment_status,
    gloss_zh: row.gloss_zh,
    gloss_en: row.gloss_en ?? null,
    phonetic_text: row.phonetic_text,
    cefr: row.cefr ?? null,
  }));
}

export function getReviewPools(): ReviewPool[] {
  const seed = loadSeedLexemes(root());
  const ngsl = readyLexemes(catalog()).slice(0, 5);
  return [
    {
      id: "seed",
      title: "演示五词",
      detail: "营地叙事词，和 CLI demo 同一批。本轮只开形界。",
      prompts: buildPublicPrompts(seed, "form"),
    },
    {
      id: "ngsl",
      title: "NGSL-S 已就绪",
      detail: "频级最高的 5 个已审校义项。其余待审校词不会被写成假释义。",
      prompts: buildPublicPrompts(ngsl, "form"),
    },
  ];
}

export function getQuest(): Quest {
  return loadQuestFromYaml(
    join(root(), "content", "quests", "echo-bazaar-info-gap-01.yaml"),
  );
}

export function findReviewLexeme(lexemeId: string) {
  const seed = loadSeedLexemes(root()).find((row) => row.id === lexemeId);
  if (seed) return seed;
  return readyLexemes(catalog()).find((row) => row.id === lexemeId);
}
