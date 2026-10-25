/**
 * Import NGSL-Spoken 1.2 → content pack artifacts + lexeme seed JSON.
 *
 * - Official list files stay under content/packs/ngsl-s-1.2/ (CC BY-SA 4.0).
 * - Seed JSON is product-owned enrichment shell; gloss_zh/phonetic/examples
 *   stay empty or come from optional enrichment file (no hallucination of 700).
 *
 * Usage:
 *   npx tsx scripts/import-ngsl-s.ts
 *   npx tsx scripts/import-ngsl-s.ts --enrichment content/lexemes/enrichment-top50-zh.json
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PACK_DIR = join(ROOT, "content/packs/ngsl-s-1.2");
const OUT_DIR = join(ROOT, "content/lexemes");

const PACK_ID = "ngsl-s-1.2";
const PACK_META = {
  id: PACK_ID,
  name: "NGSL-Spoken",
  version: "1.2",
  license: "CC-BY-SA-4.0",
  source_url: "https://www.newgeneralservicelist.com/ngsl-spoken",
  mirror_url: "https://github.com/koba-ninkigumi/ngsl",
  teaching_csv_url:
    "https://www.lextutor.ca/freq/lists_download/ngsl_browne/NGSL-Spoken_1.2_lemmatized_for_teaching.csv",
  citation:
    "NGSL-Spoken 1.2 © Charles Browne & Brent Culligan, CC BY-SA 4.0",
  coverage_note:
    "≈721 lemmas; Browne & Culligan report up to ~90% spoken coverage for NGSL-S",
};

type Enrichment = {
  lemma: string;
  gloss_zh?: string;
  phonetic_text?: string;
  example_sentence?: string;
  example_sentence_zh?: string;
  collocations?: string[];
  tags?: string[];
  cefr?: string;
};

function readLines(path: string): string[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseLemmatized(path: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of readLines(path)) {
    const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) continue;
    const lemma = parts[0].toLowerCase() === "i" ? "I" : parts[0].toLowerCase();
    // Keep canonical key lowercase except pronoun I handled via ranked list
    const key = parts[0].toLowerCase();
    map.set(key, parts);
  }
  return map;
}

function parseEnDefs(path: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = readLines(path);
  // header: Word,Definition
  for (const line of lines.slice(1)) {
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const word = line.slice(0, comma).trim();
    let def = line.slice(comma + 1).trim();
    if (def.startsWith('"') && def.endsWith('"')) def = def.slice(1, -1);
    map.set(word.toLowerCase(), def);
  }
  return map;
}

function loadEnrichment(path: string | undefined): Map<string, Enrichment> {
  const map = new Map<string, Enrichment>();
  if (!path || !existsSync(path)) return map;
  const raw = JSON.parse(readFileSync(path, "utf8")) as Enrichment[];
  for (const row of raw) {
    map.set(row.lemma.toLowerCase(), row);
  }
  return map;
}

function lemmaId(lemma: string): string {
  const safe = lemma.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `en_${safe}`;
}

function senseId(lemma: string): string {
  return `${lemmaId(lemma)}__s1`;
}

function main(): void {
  const args = process.argv.slice(2);
  let enrichmentPath: string | undefined =
    join(OUT_DIR, "enrichment-top50-zh.json");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--enrichment" && args[i + 1]) {
      enrichmentPath = resolve(args[++i]);
    }
    if (args[i] === "--no-enrichment") enrichmentPath = undefined;
  }

  const rankedPath = join(PACK_DIR, "NGSL-Spoken_1.2.txt");
  const lemPath = join(
    PACK_DIR,
    "NGSL-Spoken_1.2_lemmatized_for_teaching.csv",
  );
  const enPath = join(PACK_DIR, "NGSL-Spoken_1.2_en.csv");

  if (!existsSync(rankedPath) || !existsSync(lemPath)) {
    console.error(
      "Missing pack files. Expected NGSL-Spoken_1.2.txt and lemmatized CSV under",
      PACK_DIR,
    );
    process.exit(1);
  }

  const ranked = readLines(rankedPath);
  const forms = parseLemmatized(lemPath);
  const enDefs = existsSync(enPath) ? parseEnDefs(enPath) : new Map();
  const enrichment = loadEnrichment(enrichmentPath);

  const lemmas: unknown[] = [];
  const senses: unknown[] = [];
  const lemmaForms: unknown[] = [];
  const lexemesSeed: unknown[] = []; // 001-compatible shell rows
  const sources: unknown[] = [];

  let enriched = 0;
  let pending = 0;

  ranked.forEach((rawLemma, idx) => {
    const freq_rank = idx + 1;
    const key = rawLemma.toLowerCase();
    const lemma = rawLemma; // preserve I vs i from ranked file
    const id = lemmaId(lemma);
    const formParts = forms.get(key) ?? [lemma];
    const gloss_en = enDefs.get(key) ?? null;
    const enr = enrichment.get(key);
    const hasZh = Boolean(enr?.gloss_zh);
    const hasPhon = Boolean(enr?.phonetic_text);
    const hasEx = Boolean(enr?.example_sentence);
    const enrichment_status =
      hasZh && hasPhon && hasEx
        ? "ready"
        : hasZh || hasPhon || hasEx
          ? "partial"
          : "pending";
    if (enrichment_status === "ready" || enrichment_status === "partial") {
      enriched += 1;
    } else {
      pending += 1;
    }

    lemmas.push({
      id,
      lemma: lemma.toLowerCase() === "i" ? "I" : lemma.toLowerCase(),
      lang: "en",
      pack_id: PACK_ID,
      freq_rank,
      cefr_est: enr?.cefr ?? null,
      topic_tags: enr?.tags ?? ["ngsl-s", "spoken-mvp"],
      enrichment_status,
    });

    sources.push({
      id: `${PACK_ID}__${id}`,
      pack_id: PACK_ID,
      lemma: lemma.toLowerCase() === "i" ? "I" : lemma.toLowerCase(),
      freq_rank,
      source_row: {
        forms: formParts,
        gloss_en,
      },
    });

    for (const form of formParts) {
      const ft =
        form.toLowerCase() ===
        (lemma.toLowerCase() === "i" ? "i" : lemma.toLowerCase())
          ? "lemma"
          : "inflected";
      lemmaForms.push({
        id: `${id}__${createHash("sha1").update(form).digest("hex").slice(0, 10)}`,
        lemma_id: id,
        form,
        form_type: ft,
      });
    }

    const sid = senseId(lemma);
    const orthography = lemma.toLowerCase() === "i" ? "I" : lemma.toLowerCase();
    senses.push({
      id: sid,
      lemma_id: id,
      sense_key: "s1",
      orthography,
      phonetic_text: enr?.phonetic_text ?? null,
      gloss_zh: enr?.gloss_zh ?? null,
      gloss_en,
      example_sentence: enr?.example_sentence ?? null,
      example_sentence_zh: enr?.example_sentence_zh ?? null,
      collocations: enr?.collocations ?? [],
      tags: enr?.tags ?? ["ngsl-s", "spoken-mvp"],
      cefr: enr?.cefr ?? null,
      freq_rank,
      enrichment_status,
      source_pack_id: PACK_ID,
      license_note:
        "lemma from NGSL-Spoken 1.2 (CC BY-SA 4.0 Browne & Culligan); enrichment © Echo Shards",
    });

    // 001-compatible seed: keep required strings with placeholders when pending
    lexemesSeed.push({
      id,
      lemma: orthography,
      orthography,
      phonetic_text: enr?.phonetic_text ?? "",
      gloss_zh: enr?.gloss_zh ?? "",
      sense_id: sid,
      example_sentence: enr?.example_sentence ?? "",
      example_sentence_zh: enr?.example_sentence_zh ?? "",
      collocations: enr?.collocations ?? [],
      tags: enr?.tags ?? ["ngsl-s", "spoken-mvp"],
      cefr: enr?.cefr ?? null,
      freq_rank,
      lang: "en",
      l1: "zh",
      lemma_id: id,
      enrichment_status,
      source_pack_id: PACK_ID,
      gloss_en,
      license_note:
        "lemma from NGSL-Spoken 1.2 (CC BY-SA 4.0); enrichment status=" +
        enrichment_status,
    });
  });

  mkdirSync(OUT_DIR, { recursive: true });

  const packOut = {
    pack: { ...PACK_META, lemma_count: ranked.length },
    imported_at: new Date().toISOString(),
    stats: {
      lemmas: ranked.length,
      senses: senses.length,
      forms: lemmaForms.length,
      enrichment_touched: enriched,
      enrichment_pending: pending,
    },
  };

  writeFileSync(
    join(PACK_DIR, "pack.meta.json"),
    JSON.stringify(packOut, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(OUT_DIR, "ngsl-s-1.2-lemmas.json"),
    JSON.stringify(lemmas, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(OUT_DIR, "ngsl-s-1.2-senses.json"),
    JSON.stringify(senses, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(OUT_DIR, "ngsl-s-1.2-forms.json"),
    JSON.stringify(lemmaForms, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(OUT_DIR, "ngsl-s-1.2-lemma-sources.json"),
    JSON.stringify(sources, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(OUT_DIR, "ngsl-s-1.2-lexemes-seed.json"),
    JSON.stringify(lexemesSeed, null, 2) + "\n",
    "utf8",
  );

  console.log("NGSL-S 1.2 import OK");
  console.log(JSON.stringify(packOut.stats, null, 2));
  console.log("Wrote:");
  console.log(" -", join(PACK_DIR, "pack.meta.json"));
  console.log(" -", join(OUT_DIR, "ngsl-s-1.2-lexemes-seed.json"));
  console.log(" -", join(OUT_DIR, "ngsl-s-1.2-lemmas.json"));
  console.log(" -", join(OUT_DIR, "ngsl-s-1.2-senses.json"));
  console.log(" -", join(OUT_DIR, "ngsl-s-1.2-forms.json"));
}

main();
