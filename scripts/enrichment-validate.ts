/**
 * Validate enrichment JSON shape and catalog gloss policy.
 * - pending rows must keep empty gloss_zh (no hallucinated Chinese)
 * - ready rows must have gloss_zh + phonetic_text + example_sentence
 * Exit non-zero on violations.
 *
 * Usage: npx tsx scripts/enrichment-validate.ts
 *        npx tsx scripts/enrichment-validate.ts --file content/lexemes/enrichment-top50-zh.json
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type EnrichmentRow = {
  lemma?: string;
  gloss_zh?: string;
  phonetic_text?: string;
  example_sentence?: string;
  example_sentence_zh?: string;
  collocations?: string[];
  tags?: string[];
  cefr?: string;
};

type CatalogRow = {
  lemma: string;
  gloss_zh: string;
  phonetic_text: string;
  example_sentence: string;
  enrichment_status: string;
};

function parseArgs(): { file?: string } {
  const args = process.argv.slice(2);
  let file: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = resolve(args[++i]!);
  }
  return { file };
}

function validateEnrichmentFile(path: string): string[] {
  const failures: string[] = [];
  if (!existsSync(path)) {
    failures.push(`missing enrichment file: ${path}`);
    return failures;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`invalid JSON ${path}: ${String(error)}`);
    return failures;
  }
  if (!Array.isArray(raw)) {
    failures.push(`${path}: expected array`);
    return failures;
  }
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as EnrichmentRow;
    const lemma = (row.lemma ?? "").trim();
    if (!lemma) {
      failures.push(`${path}[${i}]: missing lemma`);
      continue;
    }
    const key = lemma.toLowerCase();
    if (seen.has(key)) failures.push(`${path}: duplicate lemma ${lemma}`);
    seen.add(key);
    const gloss = (row.gloss_zh ?? "").trim();
    const phon = (row.phonetic_text ?? "").trim();
    const ex = (row.example_sentence ?? "").trim();
    // A row present in the enrichment file is a human/editor touch.
    // If any of the three core fields is set, all three must be set (ready shape).
    const any = Boolean(gloss || phon || ex);
    if (any && !(gloss && phon && ex)) {
      failures.push(
        `${path}: lemma ${lemma} is partial — ready enrichment needs gloss_zh + phonetic_text + example_sentence`,
      );
    }
    if (gloss && /待审校|TODO|FIXME|lorem/i.test(gloss)) {
      failures.push(`${path}: lemma ${lemma} gloss_zh looks like a placeholder`);
    }
  }
  return failures;
}

function validateCatalog(path: string): string[] {
  const failures: string[] = [];
  const rows = JSON.parse(readFileSync(path, "utf8")) as CatalogRow[];
  let pending = 0;
  let ready = 0;
  for (const row of rows) {
    const status = row.enrichment_status;
    const gloss = (row.gloss_zh ?? "").trim();
    const phon = (row.phonetic_text ?? "").trim();
    const ex = (row.example_sentence ?? "").trim();
    if (status === "pending") {
      pending += 1;
      if (gloss) {
        failures.push(
          `catalog pending ${row.lemma} must keep empty gloss_zh (got “${gloss.slice(0, 24)}”)`,
        );
      }
    }
    if (status === "ready") {
      ready += 1;
      if (!gloss || !phon || !ex) {
        failures.push(
          `catalog ready ${row.lemma} missing gloss_zh/phonetic_text/example`,
        );
      }
    }
  }
  if (pending < 600) {
    failures.push(`pending count ${pending} too low — did someone invent glosses?`);
  }
  if (ready < 1) failures.push("no ready rows in catalog");
  return failures;
}

function main(): void {
  const { file } = parseArgs();
  const enrichmentPath =
    file ?? join(ROOT, "content/lexemes/enrichment-top50-zh.json");
  const catalogPath = join(ROOT, "content/lexemes/ngsl-s-1.2-lexemes-seed.json");
  const queuePath = join(ROOT, "content/lexemes/enrichment-queue.json");

  const failures: string[] = [
    ...validateEnrichmentFile(enrichmentPath),
    ...validateCatalog(catalogPath),
  ];
  if (existsSync(queuePath)) {
    const queue = JSON.parse(readFileSync(queuePath, "utf8")) as {
      items?: Array<{ gloss_zh?: string; status?: string }>;
    };
    for (const item of queue.items ?? []) {
      if ((item.gloss_zh ?? "").trim()) {
        failures.push("enrichment-queue.json must keep empty gloss_zh slots");
      }
      if (item.status && item.status !== "needs_review") {
        failures.push(`queue item status must be needs_review, got ${item.status}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("enrichment-validate FAILED:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("enrichment-validate OK");
  console.log(`  enrichment file: ${enrichmentPath}`);
  console.log(`  catalog: ${catalogPath}`);
}

main();
