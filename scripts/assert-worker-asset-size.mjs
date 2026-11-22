/**
 * After `next build`, no file in the emitted client static assets may exceed
 * the Cloudflare Workers per-asset limit of 25 MiB. This checks `static/`,
 * which OpenNext copies into the Worker asset bundle, not the webpack cache.
 * Run: node scripts/assert-worker-asset-size.mjs
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 25 * 1024 * 1024;
const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}

const webApp = path.dirname(fileURLToPath(new URL("../apps/web/package.json", import.meta.url)));
const distName = process.env.NEXT_DIST_DIR ?? ".next-build";
const staticDir = path.join(webApp, distName, "static");

check(existsSync(staticDir), `build static output not found: apps/web/${distName}/static`);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (existsSync(staticDir)) {
  const oversized = walk(staticDir)
    .map((file) => ({ file, size: statSync(file).size }))
    .filter((row) => row.size > LIMIT);
  check(
    oversized.length === 0,
    oversized
      .map((row) => `${path.relative(staticDir, row.file)} is ${(row.size / 1024 / 1024).toFixed(1)} MiB (limit 25 MiB)`)
      .join("; ") || "no static asset may exceed 25 MiB",
  );
}

if (errors.length > 0) {
  console.error(`assert-worker-asset-size: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`assert-worker-asset-size: ok (apps/web/${distName}/static)`);
