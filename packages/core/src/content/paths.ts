/**
 * Repo root is the directory that contains the NGSL-S NOTICE.
 * Walks up from cwd or from a source file so demos and the Next app agree.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const MARKER = join("content", "packs", "ngsl-s-1.2", "NOTICE");

export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Echo Shards repo root not found from ${start} (missing ${MARKER})`,
  );
}

export function contentPath(root: string, ...parts: string[]): string {
  return join(root, "content", ...parts);
}
