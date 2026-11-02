/**
 * PR1: apprentice-reachable UI must not keep「接过今日提案」as a CTA string.
 * Scans apps/web source (tsx/ts/jsx/js); docs/changelog excluded by path.
 * Run: node --import tsx scripts/assert-pr1-practice-cta.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../apps/web/src", import.meta.url).pathname;
const forbidden = "接过今日提案";
const allowExt = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".open-next") continue;
      walk(full, out);
    } else if (allowExt.has(name.slice(name.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(forbidden)) continue;
  const rel = relative(process.cwd(), file);
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    if (line.includes(forbidden)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length) {
  console.error("PR1 assert failed: found「接过今日提案」in apprentice UI source:");
  for (const h of hits) console.error(" ", h);
  process.exit(1);
}

console.log("assert-pr1-practice-cta: ok (no「接过今日提案」in apps/web/src)");
