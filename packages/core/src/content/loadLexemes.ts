/**
 * Read seed lexemes and the NGSL-S catalog from content/ via node:fs.
 * Pending rows stay pending — this loader never fills glosses.
 * For Workers / Next bundling, import JSON modules and use catalog.ts parsers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogLexeme, Lexeme } from "../models/types.js";
import { contentPath, findRepoRoot } from "./paths.js";
import {
  parseCatalog,
  parsePackMeta,
  parseSeedLexemes,
  readyLexemes,
  PackMetaSchema,
  type PackMetaFile,
} from "./catalog.js";

export {
  PackMetaSchema,
  readyLexemes,
  parseCatalog,
  parsePackMeta,
  parseSeedLexemes,
};
export type { PackMetaFile };

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function loadSeedLexemes(root: string = findRepoRoot()): Lexeme[] {
  return parseSeedLexemes(readJson(contentPath(root, "lexemes", "seed-en-zh-5.json")));
}

export function loadCatalog(root: string = findRepoRoot()): CatalogLexeme[] {
  return parseCatalog(
    readJson(contentPath(root, "lexemes", "ngsl-s-1.2-lexemes-seed.json")),
  );
}

export function loadPackMeta(root: string = findRepoRoot()): PackMetaFile {
  return parsePackMeta(
    readJson(join(root, "content", "packs", "ngsl-s-1.2", "pack.meta.json")),
  );
}
