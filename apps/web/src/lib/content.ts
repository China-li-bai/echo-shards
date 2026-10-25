import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildPublicPrompts,
  QuestSchema,
  type Aspect,
  type CatalogLexeme,
  type Lexeme,
  type PublicPrompt,
  type Quest,
} from "@echo-shards/core";
import {
  emptyCampProgress,
  type CampProgress,
} from "@echo-shards/core";
import {
  findRepoRoot,
  FileEventStore,
  loadCatalog,
  loadPackMeta,
  loadQuestFromYaml,
  loadSeedLexemes,
  readyLexemes,
  resolveDataDir,
  type PackMetaFile,
} from "@echo-shards/core/node";

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

export function getDayLexemeOptions(): DayLexemeOption[] {
  const seed = loadSeedLexemes(root()).map((row) => ({
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
  const seed = loadSeedLexemes(root());
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
  const staticPath = join(root(), "content", "quests", `${id}.yaml`);
  if (existsSync(staticPath)) return loadQuestFromYaml(staticPath);
  const generatedPath = join(root(), "content", "quests", "generated", `${id}.json`);
  if (existsSync(generatedPath)) {
    return QuestSchema.parse(JSON.parse(readFileSync(generatedPath, "utf8")));
  }
  return loadQuestFromYaml(
    join(root(), "content", "quests", "echo-bazaar-info-gap-01.yaml"),
  );
}

export function listQuests(): QuestListItem[] {
  const items: QuestListItem[] = [];
  const staticDir = join(root(), "content", "quests");
  for (const name of readdirSync(staticDir)) {
    if (!name.endsWith(".yaml")) continue;
    const quest = loadQuestFromYaml(join(staticDir, name));
    items.push({
      id: quest.id,
      title: quest.title,
      goal: quest.goal,
      source: "static",
      target_lexemes: quest.target_lexemes,
    });
  }
  const generatedDir = join(root(), "content", "quests", "generated");
  if (existsSync(generatedDir)) {
    for (const name of readdirSync(generatedDir)) {
      if (!name.endsWith(".json")) continue;
      const quest = QuestSchema.parse(
        JSON.parse(readFileSync(join(generatedDir, name), "utf8")),
      );
      items.push({
        id: quest.id,
        title: quest.title,
        goal: quest.goal,
        source: "generated",
        target_lexemes: quest.target_lexemes,
      });
    }
  }
  return items;
}

export function findReviewLexeme(lexemeId: string) {
  const seed = loadSeedLexemes(root()).find((row) => row.id === lexemeId);
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

export function getCampProgress(): CampProgress {
  try {
    const store = new FileEventStore({ dataDir: resolveDataDir(root()) });
    const fromFile = store.loadProgress();
    if (fromFile) return fromFile;
    const snap = store.loadSnapshot("demo-events");
    if (snap) {
      return store.syncProgressFrom("demo-events");
    }
  } catch {
    /* no .data yet */
  }
  return emptyCampProgress();
}
