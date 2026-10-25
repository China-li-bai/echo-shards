/**
 * Content bundled into the Worker via static imports.
 * Workers have no monorepo disk — do not use findRepoRoot / node:fs here.
 * Local CLI demos in packages/core still use findRepoRoot + readFileSync.
 */

import {
  parseCatalog,
  parsePackMeta,
  parseQuestYaml,
  parseSeedLexemes,
  QuestSchema,
  type CatalogLexeme,
  type Lexeme,
  type PackMetaFile,
  type Quest,
} from "@echo-shards/core";

import seedJson from "../../../../content/lexemes/seed-en-zh-5.json";
import catalogJson from "../../../../content/lexemes/ngsl-s-1.2-lexemes-seed.json";
import packMetaJson from "../../../../content/packs/ngsl-s-1.2/pack.meta.json";
import enrichmentQueueJson from "../../../../content/lexemes/enrichment-queue.json";
import questBazaarYaml from "../../../../content/quests/echo-bazaar-info-gap-01.yaml";
import questCampYaml from "../../../../content/quests/echo-camp-supply-02.yaml";
import generatedSeedQuest from "../../../../content/quests/generated/generated-seed-echo-bazaar.json";

export interface EnrichmentQueueFile {
  generated_at?: string;
  pending_total?: number;
  limit?: number;
  policy?: string;
  items?: Array<{
    lemma: string;
    lemma_id: string;
    freq_rank: number | null;
    gloss_en: string | null;
    gloss_zh: string;
    status: string;
  }>;
}

const STATIC_QUEST_YAML: Record<string, string> = {
  "echo-bazaar-info-gap-01": questBazaarYaml,
  "echo-camp-supply-02": questCampYaml,
};

const GENERATED_QUEST_JSON: Record<string, unknown> = {
  "generated-seed-echo-bazaar": generatedSeedQuest,
};

let seedCache: Lexeme[] | null = null;
let catalogCache: CatalogLexeme[] | null = null;
let packMetaCache: PackMetaFile | null = null;
let staticQuestsCache: Quest[] | null = null;
let generatedQuestsCache: Quest[] | null = null;

export function bundledSeedLexemes(): Lexeme[] {
  seedCache ??= parseSeedLexemes(seedJson);
  return seedCache;
}

export function bundledCatalog(): CatalogLexeme[] {
  catalogCache ??= parseCatalog(catalogJson);
  return catalogCache;
}

export function bundledPackMeta(): PackMetaFile {
  packMetaCache ??= parsePackMeta(packMetaJson);
  return packMetaCache;
}

export function bundledEnrichmentQueue(): EnrichmentQueueFile {
  return enrichmentQueueJson as EnrichmentQueueFile;
}

function staticQuests(): Quest[] {
  if (!staticQuestsCache) {
    staticQuestsCache = Object.values(STATIC_QUEST_YAML).map((raw) =>
      parseQuestYaml(raw),
    );
  }
  return staticQuestsCache;
}

function generatedQuests(): Quest[] {
  if (!generatedQuestsCache) {
    generatedQuestsCache = Object.values(GENERATED_QUEST_JSON).map((raw) =>
      QuestSchema.parse(raw),
    );
  }
  return generatedQuestsCache;
}

export function bundledQuestById(id: string): Quest {
  const yaml = STATIC_QUEST_YAML[id];
  if (yaml) return parseQuestYaml(yaml);
  const generated = GENERATED_QUEST_JSON[id];
  if (generated) return QuestSchema.parse(generated);
  return parseQuestYaml(STATIC_QUEST_YAML["echo-bazaar-info-gap-01"]!);
}

export function bundledListQuests(): Quest[] {
  return [...staticQuests(), ...generatedQuests()];
}

export function bundledQuestSource(id: string): "static" | "generated" | null {
  if (id in STATIC_QUEST_YAML) return "static";
  if (id in GENERATED_QUEST_JSON) return "generated";
  return null;
}
