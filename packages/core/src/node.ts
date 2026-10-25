/**
 * Node-only entry. Imports node:fs. Do not import this from client components.
 * Prefer @echo-shards/core catalog parsers + bundled JSON for Workers.
 */

export { loadQuestFromYaml, parseQuestYaml, validateQuestObject } from "./quest/loadQuest.js";
export { contentPath, findRepoRoot } from "./content/paths.js";
export {
  loadCatalog,
  loadPackMeta,
  loadSeedLexemes,
  PackMetaSchema,
  readyLexemes,
  parseCatalog,
  parsePackMeta,
  parseSeedLexemes,
} from "./content/loadLexemes.js";
export type { PackMetaFile } from "./content/catalog.js";

export {
  DEFAULT_DATA_DIR,
  FileEventStore,
  resolveDataDir,
} from "./persist/file-store.js";
export type { FileStoreOptions } from "./persist/file-store.js";
