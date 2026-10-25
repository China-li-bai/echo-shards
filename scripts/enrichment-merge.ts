/**
 * Merge a reviewed enrichment batch into enrichment-top50-zh.json (or --target),
 * then re-run import-ngsl-s.ts. Never invents fields — reviewed rows must already
 * carry gloss_zh + phonetic_text + example_sentence.
 *
 * Usage:
 *   npx tsx scripts/enrichment-merge.ts --from path/to/reviewed.json
 *   npx tsx scripts/enrichment-merge.ts --from content/lexemes/enrichment-queue.json --dry-run
 *
 * Reviewed file shapes accepted:
 *   1) Enrichment array: [{ lemma, gloss_zh, phonetic_text, example_sentence, ... }]
 *   2) Queue object with items[] where status may be "reviewed" and fields filled
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type EnrichmentRow = {
  lemma: string;
  gloss_zh?: string;
  phonetic_text?: string;
  example_sentence?: string;
  example_sentence_zh?: string;
  collocations?: string[];
  tags?: string[];
  cefr?: string;
};

function parseArgs(): { from?: string; target: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let from: string | undefined;
  let target = join(ROOT, "content/lexemes/enrichment-top50-zh.json");
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) from = resolve(args[++i]!);
    if (args[i] === "--target" && args[i + 1]) target = resolve(args[++i]!);
    if (args[i] === "--dry-run") dryRun = true;
  }
  return { from, target, dryRun };
}

function loadReviewed(path: string): EnrichmentRow[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as
    | EnrichmentRow[]
    | { items?: Array<EnrichmentRow & { status?: string }> };
  const rows: EnrichmentRow[] = Array.isArray(raw)
    ? raw
    : (raw.items ?? []).filter(
        (row) =>
          row.status === "reviewed" ||
          (Boolean(row.gloss_zh?.trim()) &&
            Boolean(row.phonetic_text?.trim()) &&
            Boolean(row.example_sentence?.trim())),
      );
  const ready: EnrichmentRow[] = [];
  for (const row of rows) {
    const gloss = (row.gloss_zh ?? "").trim();
    const phon = (row.phonetic_text ?? "").trim();
    const ex = (row.example_sentence ?? "").trim();
    if (!row.lemma?.trim()) throw new Error("reviewed row missing lemma");
    if (!(gloss && phon && ex)) {
      throw new Error(
        `refusing to merge ${row.lemma}: need gloss_zh + phonetic_text + example_sentence (no invention)`,
      );
    }
    ready.push({
      lemma: row.lemma.trim(),
      gloss_zh: gloss,
      phonetic_text: phon,
      example_sentence: ex,
      example_sentence_zh: row.example_sentence_zh?.trim() || undefined,
      collocations: row.collocations ?? [],
      tags: row.tags ?? ["ngsl-s", "spoken-mvp"],
      cefr: row.cefr,
    });
  }
  return ready;
}

function main(): void {
  const { from, target, dryRun } = parseArgs();
  if (!from) {
    console.error("Usage: enrichment-merge --from <reviewed.json> [--target ...] [--dry-run]");
    process.exit(2);
  }
  if (!existsSync(from)) {
    console.error(`missing --from ${from}`);
    process.exit(1);
  }
  const incoming = loadReviewed(from);
  if (incoming.length === 0) {
    console.error("no reviewed rows to merge (fill gloss_zh/phonetic/example and mark reviewed)");
    process.exit(1);
  }
  const existing: EnrichmentRow[] = existsSync(target)
    ? (JSON.parse(readFileSync(target, "utf8")) as EnrichmentRow[])
    : [];
  const map = new Map(existing.map((row) => [row.lemma.toLowerCase(), row]));
  for (const row of incoming) {
    map.set(row.lemma.toLowerCase(), row);
  }
  const merged = [...map.values()].sort((a, b) => a.lemma.localeCompare(b.lemma));
  console.log(`merge ${incoming.length} reviewed → ${merged.length} total in ${target}`);
  if (dryRun) {
    console.log("dry-run: not writing, not importing");
    return;
  }
  writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  const imp = spawnSync(
    process.execPath,
    [
      join(ROOT, "node_modules/tsx/dist/cli.mjs"),
      join(ROOT, "scripts/import-ngsl-s.ts"),
      "--enrichment",
      target,
    ],
    { stdio: "inherit", cwd: ROOT },
  );
  if (imp.status !== 0) process.exit(imp.status ?? 1);
  const val = spawnSync(
    process.execPath,
    [
      join(ROOT, "node_modules/tsx/dist/cli.mjs"),
      join(ROOT, "scripts/enrichment-validate.ts"),
      "--file",
      target,
    ],
    { stdio: "inherit", cwd: ROOT },
  );
  if (val.status !== 0) process.exit(val.status ?? 1);
  console.log("enrichment-merge OK");
}

main();
