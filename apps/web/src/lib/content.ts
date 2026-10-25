import {
  buildPublicPrompts,
  emptyCampProgress,
  readyLexemes,
  type Aspect,
  type CatalogLexeme,
  type Lexeme,
  type PublicPrompt,
  type Quest,
  type PackMetaFile,
} from "@echo-shards/core";
import {
  bundledCatalog,
  bundledEnrichmentQueue,
  bundledListQuests,
  bundledPackMeta,
  bundledQuestById,
  bundledQuestSource,
  bundledSeedLexemes,
  type EnrichmentQueueFile,
} from "./bundled-content";

export type PoolId = "seed" | "ngsl";

export interface ReviewPool {
  id: PoolId;
  title: string;
  detail: string;
  aspect: Aspect;
  prompts: PublicPrompt[];
  lexemes: Lexeme[];
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

export interface DayLexemeOption {
  id: string;
  orthography: string;
  gloss_zh: string;
  phonetic_text: string;
  source: "seed" | "ngsl";
}

export interface QuestListItem {
  id: string;
  title: string;
  goal: string;
  source: "static" | "generated";
  target_lexemes: string[];
}

function catalog(): CatalogLexeme[] {
  return bundledCatalog();
}

export function getFloorSummary(): FloorSummary {
  const meta = bundledPackMeta();
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

export function getDayLexemeOptions(): DayLexemeOption[] {
  const seed = bundledSeedLexemes().map((row) => ({
    id: row.id,
    orthography: row.orthography,
    gloss_zh: row.gloss_zh,
    phonetic_text: row.phonetic_text,
    source: "seed" as const,
  }));
  const ngsl = readyLexemes(catalog())
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      orthography: row.orthography,
      gloss_zh: row.gloss_zh,
      phonetic_text: row.phonetic_text,
      source: "ngsl" as const,
    }));
  const seen = new Set<string>();
  const out: DayLexemeOption[] = [];
  for (const row of [...seed, ...ngsl]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function getReviewPools(aspect: Aspect = "form"): ReviewPool[] {
  const seed = bundledSeedLexemes();
  const ngsl = readyLexemes(catalog()).slice(0, 5);
  const aspectLabel =
    aspect === "meaning" ? "义界" : aspect === "phonology_text" ? "音界·文字" : "形界";
  return [
    {
      id: "seed",
      title: "演示五词",
      detail: `营地叙事词，和 CLI demo 同一批。本轮只开${aspectLabel}。`,
      aspect,
      prompts: buildPublicPrompts(seed, aspect),
      lexemes: seed,
    },
    {
      id: "ngsl",
      title: "NGSL-S 已就绪",
      detail: `频级最高的 5 个已审校义项。其余待审校词不会被写成假释义。本轮只开${aspectLabel}。`,
      aspect,
      prompts: buildPublicPrompts(ngsl, aspect),
      lexemes: ngsl,
    },
  ];
}

export function getQuest(id = "echo-bazaar-info-gap-01"): Quest {
  return bundledQuestById(id);
}

export function listQuests(): QuestListItem[] {
  return bundledListQuests().map((quest) => ({
    id: quest.id,
    title: quest.title,
    goal: quest.goal,
    source: bundledQuestSource(quest.id) ?? "static",
    target_lexemes: quest.target_lexemes,
  }));
}

export function findReviewLexeme(lexemeId: string) {
  const seed = bundledSeedLexemes().find((row) => row.id === lexemeId);
  if (seed) return seed;
  return readyLexemes(catalog()).find((row) => row.id === lexemeId);
}

export function resolveDayLexemes(ids: string[]): Lexeme[] {
  const out: Lexeme[] = [];
  const seen = new Set<string>();
  for (const id of ids.slice(0, 5)) {
    if (seen.has(id)) continue;
    const lexeme = findReviewLexeme(id);
    if (!lexeme) continue;
    seen.add(id);
    out.push(lexeme);
  }
  return out;
}

export function getEvalSnapshot() {
  const floor = getFloorSummary();
  const pendingEmpty = catalog().filter(
    (row) => row.enrichment_status === "pending" && !row.gloss_zh.trim(),
  ).length;
  return {
    floor,
    pendingEmptyGloss: pendingEmpty,
    quests: listQuests(),
  };
}

/**
 * Camp progress from .data/ is Node-local only. Workers have no writable
 * monorepo disk — return empty progress (same as a fresh camp).
 */
export function getCampProgress() {
  return emptyCampProgress();
}

export function getEnrichmentQueue(): EnrichmentQueueFile {
  return bundledEnrichmentQueue();
}
