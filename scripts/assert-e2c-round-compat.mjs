/**
 * E2c: old round snapshots stay readable. Missing client_event_id is filled
 * without calling rate. Unknown versions are kept and explained.
 * Run: node --import tsx scripts/assert-e2c-round-compat.mjs
 */
import { readFileSync } from "node:fs";
import {
  LOCAL_LEARNER_ID,
  TideScheduler,
  deriveAspectUnlockState,
} from "../packages/core/src/index.ts";
import { clearPracticeRecords } from "../apps/web/src/lib/clear-practice-local.ts";
import {
  ROUND_CONFLICT_MESSAGE,
  ROUND_INVALID_MESSAGE,
  ROUND_SAVE_FAILED_MESSAGE,
  ROUND_UNREADABLE_MESSAGE,
  openStoredRound,
} from "../apps/web/src/lib/round-compat.ts";
import { dayIdShanghai } from "../packages/core/src/index.ts";

const failures = [];

function check(cond, message) {
  if (!cond) failures.push(message);
}

function section(name, run) {
  try {
    run();
  } catch (error) {
    failures.push(`${name} threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  let failWrite = false;
  return {
    get length() {
      return Object.keys(data).length;
    },
    key(index) {
      return Object.keys(data)[index] ?? null;
    },
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      if (failWrite) throw new Error("disk full");
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    setFailWrite(value) {
      failWrite = value;
    },
    dump() {
      return { ...data };
    },
  };
}

const t0 = new Date("2026-10-25T01:00:00.000Z");
const t1 = new Date("2026-10-25T02:00:00.000Z");
const t2 = new Date("2026-10-25T03:00:00.000Z");
const KEY = "echo-shards.round.v2:seed:meaning";

function historicalRound() {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const meaning = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  const form = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "form", t0);
  tide.rate(meaning.id, 3, t1);
  tide.rate(form.id, 2, t2);
  const snap = JSON.parse(JSON.stringify(tide.snapshot()));
  for (const log of snap.logs) delete log.client_event_id;
  return {
    version: 2,
    aspect: "meaning",
    lexemeIds: ["en_tide"],
    tide: snap,
    log: { runs: [], proposals: [], events: [], eval_scores: [] },
    index: 1,
    phase: "answer",
    typed: "",
    reveal: null,
    why: "这一轮只练「意思」，大约 1 个词。对完你点个等级后，会告诉你改天再练的时间。",
    batchId: "batch-old",
    lastDue: null,
  };
}

function finger(snapshot) {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  tide.restore(snapshot);
  return {
    cards: tide.allCards().map((card) => ({
      id: card.id,
      reps: card.review.reps,
      due: card.review.due.toISOString(),
      stability: card.review.stability,
      difficulty: card.review.difficulty,
      state: card.review.state,
    })),
    logs: tide.getLogs().map((log) => ({
      card_id: log.card_id,
      grade: log.grade,
      at: log.reviewed_at.toISOString(),
      id: log.client_event_id ?? null,
    })),
    unlock: deriveAspectUnlockState("en_tide", "form", tide.getLogs(), undefined, tide.allCards()),
  };
}

function validate(round) {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  tide.restore(round.tide);
}

section("old logs gain a stable id without a new rate", () => {
  const round = historicalRound();
  const before = finger(round.tide);
  check(before.logs.every((log) => log.id === null), "fixture logs have no client_event_id");
  const storage = memoryStorage({ [KEY]: JSON.stringify(round) });
  const first = openStoredRound(storage, KEY, validate);
  check(first.status === "ready" && first.migrated === true && first.saved === true, "first load migrates and saves");
  const stored = JSON.parse(storage.getItem(KEY));
  const after = finger(stored.tide);
  check(JSON.stringify(after.cards) === JSON.stringify(before.cards), "migration does not move due, reps, or stability");
  check(after.unlock === before.unlock, "unlock progress stays the same");
  check(after.logs.map((log) => `${log.grade}@${log.at}`).join() === before.logs.map((log) => `${log.grade}@${log.at}`).join(), "grade and time stay put");
  check(after.logs.every((log) => typeof log.id === "string" && log.id.length > 0), "each old log receives an id");
  check(new Set(after.logs.map((log) => log.id)).size === after.logs.length, "different old logs do not share an id");
  const second = openStoredRound(storage, KEY, validate);
  check(second.status === "ready" && second.migrated === false, "second load does not migrate again");
  check(storage.getItem(KEY) === JSON.stringify(stored), "second load does not rewrite the saved text");
  const reparsed = JSON.parse(JSON.stringify(stored));
  check(
    finger(reparsed.tide).logs.map((log) => log.id).join() === after.logs.map((log) => log.id).join(),
    "derived ids survive another serialization",
  );
});

section("existing ids are kept", () => {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_echo" }, "meaning", t0);
  tide.rate(card.id, 4, t1, { clientEventId: "keep-me" });
  const round = historicalRound();
  round.tide = JSON.parse(JSON.stringify(tide.snapshot()));
  const storage = memoryStorage({ [KEY]: JSON.stringify(round) });
  const opened = openStoredRound(storage, KEY, validate);
  check(opened.status === "ready" && opened.migrated === false, "a snapshot that already has ids is not rewritten");
  check(JSON.parse(storage.getItem(KEY)).tide.logs[0].client_event_id === "keep-me", "existing id stays");
  check(storage.getItem(KEY) === JSON.stringify(round), "untouched snapshot bytes stay");
});

section("bad records are kept", () => {
  const cases = [
    ["corrupt json", "{", ROUND_UNREADABLE_MESSAGE],
    ["future version", JSON.stringify({ version: 9, tide: { cards: [], logs: [] } }), ROUND_UNREADABLE_MESSAGE],
    ["missing version", JSON.stringify({ aspect: "meaning" }), ROUND_UNREADABLE_MESSAGE],
    ["missing tide", JSON.stringify({ version: 2, aspect: "meaning" }), ROUND_INVALID_MESSAGE],
    ["bad grade", JSON.stringify(badGradeRound()), ROUND_INVALID_MESSAGE],
    ["duplicate legacy id", JSON.stringify(duplicateRound()), ROUND_CONFLICT_MESSAGE],
  ];
  for (const [label, raw, message] of cases) {
    const storage = memoryStorage({
      [KEY]: raw,
      "echo-shards.day-plan.v1": "{\"version\":1}",
      "echo-shards.quest-log.v1": "{\"version\":1}",
    });
    const opened = openStoredRound(storage, KEY, validate);
    check(opened.status === "held" && opened.message === message, `${label} is held with the learner message`);
    check(storage.getItem(KEY) === raw, `${label} does not overwrite or delete the original`);
    check(storage.getItem("echo-shards.day-plan.v1") === "{\"version\":1}", `${label} leaves the day plan`);
    check(storage.getItem("echo-shards.quest-log.v1") === "{\"version\":1}", `${label} leaves the quest log`);
    check(!opened.message.includes("version") && !opened.message.includes("JSON") && !opened.message.includes("client_event_id"), `${label} message has no storage jargon`);
  }
});

section("save failure keeps the original", () => {
  const round = historicalRound();
  const raw = JSON.stringify(round);
  const storage = memoryStorage({ [KEY]: raw });
  storage.setFailWrite(true);
  const opened = openStoredRound(storage, KEY, validate);
  check(opened.status === "ready" && opened.saved === false, "failed write is not reported as saved");
  check(opened.message === ROUND_SAVE_FAILED_MESSAGE, "failed write explains that the original remains");
  check(storage.getItem(KEY) === raw, "failed write leaves the old text in place");
  check(opened.round.tide.logs.every((log) => log.client_event_id), "memory copy still has the derived ids");
});

function isTodayPlan(storage) {
  const raw = storage.getItem("echo-shards.day-plan.v1");
  if (!raw) return false;
  const plan = JSON.parse(raw);
  if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return false;
  return Boolean(plan.variant?.lexeme_ids?.length);
}

section("day plan and clear still behave", () => {
  const today = dayIdShanghai();
  const storage = memoryStorage({
    "echo-shards.day-plan.v1": JSON.stringify({
      version: 1,
      day_id: "2000-01-01",
      variant: { lexeme_ids: ["en_tide"] },
    }),
    [KEY]: JSON.stringify({ version: 9 }),
  });
  check(isTodayPlan(storage) === false, "a day plan from another Shanghai day is not today's plan");
  storage.setItem(
    "echo-shards.day-plan.v1",
    JSON.stringify({ version: 1, day_id: today, variant: { lexeme_ids: ["en_tide"] } }),
  );
  check(isTodayPlan(storage) === true, "today's day plan is still readable");
  const dayPlanSource = readFileSync(new URL("../apps/web/src/lib/learner-practice-local.ts", import.meta.url), "utf8");
  check(dayPlanSource.includes("plan.version !== 1"), "day plan reader still requires version 1");
  const removed = clearPracticeRecords(storage);
  check(removed.includes(KEY), "clear still removes the round key when the learner asks");
  check(storage.getItem(KEY) === null, "clear actually deletes it");
});

section("review page uses the loader", () => {
  const source = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(source.includes("openStoredRound"), "review session loads through openStoredRound");
  check(source.includes("recordHold"), "review session can show a held record");
  check(!source.includes("rejecting tainted tide snapshot"), "failed load no longer deletes the round and starts over");
  check(!source.includes("ignoring review snapshot"), "unknown versions are not silently ignored");
});

function badGradeRound() {
  const round = historicalRound();
  round.tide.logs[0].grade = 9;
  return round;
}

function duplicateRound() {
  const round = historicalRound();
  round.tide.logs[1] = {
    ...round.tide.logs[0],
    id: "log-copy",
  };
  return round;
}

if (failures.length > 0) {
  console.error(`assert-e2c-round-compat: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e2c-round-compat: ok");
