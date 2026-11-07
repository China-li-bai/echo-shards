/**
 * PR8: demo hygiene — 清空练习记录 copy + clear echo-shards.* keys; keep word lists.
 * Run: node --import tsx scripts/assert-pr8-clear-practice.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLEAR_PRACTICE_BUTTON_LABEL,
  CLEAR_PRACTICE_CONFIRM,
  CLEAR_PRACTICE_HELP,
  LEARNER_STORAGE_PREFIX,
  PRACTICE_STORAGE_EXACT_KEYS,
  PRACTICE_STORAGE_PREFIXES,
  clearPracticeRecords,
  listLearnerStorageKeys,
} from "../apps/web/src/lib/clear-practice-local.ts";

const webSrc = new URL("../apps/web/src", import.meta.url).pathname;
const errors = [];

function read(rel) {
  return readFileSync(join(webSrc, rel), "utf8");
}

const clearLib = read("lib/clear-practice-local.ts");
const clearUi = read("components/clear-practice-records.tsx");
const footer = read("components/site-footer.tsx");

if (CLEAR_PRACTICE_BUTTON_LABEL !== "清空练习记录") {
  errors.push(`button label must be 清空练习记录, got ${CLEAR_PRACTICE_BUTTON_LABEL}`);
}
if (CLEAR_PRACTICE_HELP !== "只清这台设备上的练习进度，词表还在。") {
  errors.push(`help copy mismatch: ${CLEAR_PRACTICE_HELP}`);
}
if (CLEAR_PRACTICE_CONFIRM !== "确定清空？") {
  errors.push(`confirm copy mismatch: ${CLEAR_PRACTICE_CONFIRM}`);
}
if (!clearUi.includes("CLEAR_PRACTICE_BUTTON_LABEL") || !clearUi.includes("window.confirm")) {
  errors.push("UI must use 合签 label + window.confirm before clear");
}
if (!clearUi.includes("CLEAR_PRACTICE_CONFIRM")) {
  errors.push("UI must confirm with CLEAR_PRACTICE_CONFIRM");
}
if (!clearUi.includes("clearPracticeRecords")) {
  errors.push("UI must call clearPracticeRecords");
}
if (!clearUi.includes('window.location.assign("/")') && !clearUi.includes("location.assign")) {
  errors.push("after clear must navigate/reload to cold-start camp");
}
if (!footer.includes("ClearPracticeRecords") || !footer.includes("演示")) {
  errors.push("site-footer must host ClearPracticeRecords under 演示 (non-primary)");
}
if (!clearLib.includes("echo-shards.day-plan") || !clearLib.includes("round.v2")) {
  errors.push("clear lib must document day-plan + round.v2 keys");
}
if (!clearLib.includes("quest-log") || !clearLib.includes("proto.")) {
  errors.push("clear lib must document quest-log + proto prefixes");
}
if (LEARNER_STORAGE_PREFIX !== "echo-shards.") {
  errors.push("LEARNER_STORAGE_PREFIX must be echo-shards.");
}
if (!PRACTICE_STORAGE_EXACT_KEYS.includes("echo-shards.day-plan.v1")) {
  errors.push("exact keys must include day-plan.v1");
}
if (!PRACTICE_STORAGE_EXACT_KEYS.includes("echo-shards.quest-log.v1")) {
  errors.push("exact keys must include quest-log.v1");
}
if (!PRACTICE_STORAGE_PREFIXES.some((p) => p.startsWith("echo-shards.round.v2"))) {
  errors.push("prefixes must include round.v2:");
}
if (!PRACTICE_STORAGE_PREFIXES.includes("echo-shards.proto.")) {
  errors.push("prefixes must include echo-shards.proto.");
}

/** Minimal in-memory Storage for Node assert. */
function makeMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
  };
}

const storage = makeMemoryStorage({
  "echo-shards.day-plan.v1": '{"version":1}',
  "echo-shards.round.v2:day:meaning": '{"version":2}',
  "echo-shards.round.v2:ngsl:form": '{"version":2}',
  "echo-shards.quest-log.v1": '{"version":1}',
  "echo-shards.proto.day-tide.v2": "{}",
  "unrelated.app.token": "keep-me",
  theme: "dark",
});

const before = listLearnerStorageKeys(storage);
if (before.length !== 5) {
  errors.push(`expected 5 learner keys before clear, got ${before.length}: ${before}`);
}
const removed = clearPracticeRecords(storage);
if (removed.length !== 5) {
  errors.push(`expected 5 removed, got ${removed.length}`);
}
if (listLearnerStorageKeys(storage).length !== 0) {
  errors.push("learner keys should be empty after clear");
}
if (storage.getItem("unrelated.app.token") !== "keep-me" || storage.getItem("theme") !== "dark") {
  errors.push("must not delete non echo-shards.* keys (word lists / foreign keys)");
}
if (storage.getItem("echo-shards.day-plan.v1") !== null) {
  errors.push("day-plan should be gone");
}

if (errors.length) {
  console.error("PR8 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log(
  "assert-pr8-clear-practice: ok (合签文案, echo-shards.* clear, footer 演示区, keep non-learner keys)",
);
