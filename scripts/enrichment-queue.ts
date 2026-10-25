/**
 * Emit content/lexemes/enrichment-queue.json — next N pending lemmas with
 * upstream EN definition only. Empty gloss_zh slots for human editors.
 * Never invents Chinese glosses.
 *
 * Usage: npx tsx scripts/enrichment-queue.ts
 *        npx tsx scripts/enrichment-queue.ts --limit 20
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type CatalogRow = {
  id: string;
  lemma: string;
  orthography: string;
  gloss_zh: string;
  gloss_en?: string | null;
  phonetic_text: string;
  example_sentence: string;
  enrichment_status: string;
  freq_rank?: number | null;
};

function parseLimit(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) return Math.max(1, Number(args[++i]));
  }
  return 25;
}

function main(): void {
  const limit = parseLimit();
  const catalog = JSON.parse(
    readFileSync(join(ROOT, "content/lexemes/ngsl-s-1.2-lexemes-seed.json"), "utf8"),
  ) as CatalogRow[];
  const pending = catalog
    .filter((row) => row.enrichment_status === "pending")
    .sort((a, b) => (a.freq_rank ?? 99999) - (b.freq_rank ?? 99999));

  const items = pending.slice(0, limit).map((row) => ({
    lemma: row.lemma,
    lemma_id: row.id,
    orthography: row.orthography,
    freq_rank: row.freq_rank ?? null,
    gloss_en: row.gloss_en ?? null,
    status: "needs_review" as const,
    // Human editors fill these; validate refuses non-empty until merge.
    gloss_zh: "",
    phonetic_text: "",
    example_sentence: "",
    example_sentence_zh: "",
    collocations: [] as string[],
    tags: ["ngsl-s", "spoken-mvp"],
    cefr: null as string | null,
    notes: "Fill gloss_zh / phonetic_text / example from editorial review. Do not invent.",
  }));

  const out = {
    generated_at: new Date().toISOString(),
    source_pack: "ngsl-s-1.2",
    limit,
    pending_total: pending.length,
    policy: "empty gloss_zh only; human merge via enrichment-merge.ts; no hallucination",
    items,
  };
  const outPath = join(ROOT, "content/lexemes/enrichment-queue.json");
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`enrichment-queue OK → ${outPath}`);
  console.log(`  queued ${items.length} of ${pending.length} pending`);
}

main();
