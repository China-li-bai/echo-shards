/**
 * E3b: after a meaning recall is saved, one short sentence step.
 * It calls checkMeaningUse and stores meaning_use. It does not rate.
 * Run: node --import tsx scripts/assert-e3b-meaning-use-step.mjs
 */
import { readFileSync } from "node:fs";
import { LOCAL_LEARNER_ID, TideScheduler, deriveAspectUnlockState } from "../packages/core/src/index.ts";
import { clearPracticeRecords } from "../apps/web/src/lib/clear-practice-local.ts";
import {
  MEANING_USE_HELD_MESSAGE,
  MEANING_USE_SAVE_FAILED_MESSAGE,
  MEANING_USE_SKIP_NOTE,
  MEANING_USE_STORAGE_KEY,
  buildMeaningUseOffer,
  createMeaningUseStep,
  meaningUseKeyAction,
  normalizeRoundPhase,
} from "../apps/web/src/lib/meaning-use-step.ts";

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
  };
}

const t0 = new Date("2026-10-25T01:00:00.000Z");
const t1 = new Date("2026-10-25T02:00:00.000Z");
const t2 = new Date("2026-10-25T02:05:00.000Z");

function ratedTide() {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  tide.rate(card.id, 3, t1, { clientEventId: "recall-1" });
  return { tide, card };
}

function stepFor(storage, times = [t2, t2, t2]) {
  let n = 0;
  let clock = 0;
  return createMeaningUseStep({
    storage,
    now: () => times[Math.min(clock++, times.length - 1)],
    newId: () => `use-${++n}`,
  });
}

const ready = {
  aspect: "meaning",
  cardId: "local-learner:en_tide:meaning",
  lemma: "tide",
  forms: ["tide"],
  enrichment_status: "ready",
};

section("recall then sentence then continue", () => {
  const { tide, card } = ratedTide();
  const before = JSON.stringify(tide.snapshot());
  const unlockBefore = deriveAspectUnlockState("en_tide", "meaning", tide.getLogs(), undefined, tide.allCards());
  const storage = memoryStorage();
  const step = stepFor(storage);
  const offer = step.offer(ready);
  check(offer.offered === true, "ready meaning card opens the sentence step");
  check(meaningUseKeyAction("1") === "ignore", "digit keys do not grade during the sentence");
  check(meaningUseKeyAction("Enter") === "submit", "enter submits the sentence");
  const ignored = step.applyKey("3");
  check(ignored.handled === "ignore", "digit key is ignored");
  check(JSON.stringify(tide.snapshot()) === before, "ignored key does not rate");
  step.setText("潮汐来了");
  const failed = step.submit();
  check(failed.saved === false && failed.records === 0, "Chinese sentence is not stored as success");
  check(failed.note.includes("中文"), "Chinese failure is plain language");
  check(step.view().text === "潮汐来了", "failed text stays editable");
  step.setText("The tide is high.");
  const passed = step.submit();
  check(passed.saved === true && passed.records === 1, "a real sentence stores one meaning_use record");
  check(passed.note === "这句话里有这个词。意思用得对不对，还没判断。", "pass does not claim the meaning was judged");
  check(!/学会|会用了|掌握|语义正确/.test(passed.note), "pass note is honest");
  const again = step.submit();
  check(again.saved === true && again.records === 1, "second submit does not write another event");
  const finish = step.finish();
  const finishAgain = step.finish();
  check(finish.advance === true && finishAgain.advance === false, "continue advances once");
  check(JSON.stringify(tide.snapshot()) === before, "sentence step does not change due or reps");
  check(
    deriveAspectUnlockState("en_tide", "meaning", tide.getLogs(), undefined, tide.allCards()) === unlockBefore,
    "sentence step does not change unlock",
  );
  check(tide.getCard(card.id).review.reps === 1, "recall rep stays one");
  const stored = JSON.parse(storage.getItem(MEANING_USE_STORAGE_KEY));
  check(stored.schema_version === 1, "log schema version is 1");
  const row = stored.records[0];
  check(row.id === "use-1", "record id is stable");
  check(row.event_type === "meaning_use", "record is meaning_use");
  check(row.meaning_judged === false && row.semantic_status === "not_evaluated", "record keeps not_evaluated");
  check(row.lemma === "tide" && row.sentence === "The tide is high.", "record stores target and text");
  check(row.checked_at === t2.toISOString(), "record time comes from the injected clock");
  check(row.verdict === "basic_pass", "record stores the basic verdict");
});

section("forms, skip, and scope", () => {
  const storage = memoryStorage();
  const step = stepFor(storage);
  const withForms = step.offer({ ...ready, forms: ["tide", "tides"] });
  check(withForms.offered === true, "controlled forms are accepted");
  step.setText("The tides turn.");
  const passed = step.submit();
  check(passed.saved === true, "a listed inflection can pass");
  check(JSON.parse(storage.getItem(MEANING_USE_STORAGE_KEY)).records[0].forms.join() === "tide,tides", "forms are stored with the record");

  const pending = stepFor(memoryStorage()).offer({ ...ready, enrichment_status: "pending" });
  check(pending.offered === false && pending.records === 0, "pending words are not offered");
  const sound = stepFor(memoryStorage()).offer({ ...ready, aspect: "phonology_text" });
  check(sound.offered === false, "phonology does not open the sentence step");
  const built = buildMeaningUseOffer({
    aspect: "meaning",
    cardId: ready.cardId,
    orthography: "tide",
    inReadyPool: true,
  });
  check(built?.forms.join() === "tide" && built.enrichment_status === "ready", "page target uses the ready spelling only");
  check(
    buildMeaningUseOffer({ aspect: "form", cardId: "x", orthography: "tide", inReadyPool: true }) === null,
    "form practice is not asked to make a sentence",
  );

  const skipping = stepFor(memoryStorage());
  skipping.offer(ready);
  const skipped = skipping.skip();
  check(skipped.saved === true && skipped.verdict === "skipped", "skip is stored");
  check(skipped.note === MEANING_USE_SKIP_NOTE, "skip is not called mastery");
  check(skipping.skip().records === 1, "skip twice writes one record");
  check(skipping.finish().advance === true, "skip can continue");
});

section("keys, re-entry, save failure, reload", () => {
  const storage = memoryStorage();
  const step = stepFor(storage, [t2]);
  step.offer(ready);
  step.setText("The tide is high.");
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    step.submit();
    originalSet(key, value);
  };
  const entered = step.applyKey("Enter");
  check(entered.handled === "submit" && entered.records === 1, "enter writes one record even if save re-enters");
  storage.setItem = originalSet;

  const flaky = memoryStorage();
  const retry = stepFor(flaky, [t2]);
  retry.offer(ready);
  retry.setText("The tide is high.");
  flaky.setFailWrite(true);
  const failedSave = retry.submit();
  check(failedSave.saved === false && failedSave.note === MEANING_USE_SAVE_FAILED_MESSAGE, "disk failure is visible");
  check(flaky.getItem(MEANING_USE_STORAGE_KEY) === null, "failed write does not leave a partial log");
  check(retry.view().text === "The tide is high.", "text remains for retry");
  flaky.setFailWrite(false);
  const saved = retry.submit();
  check(saved.saved === true && saved.records === 1, "retry writes one record");
  check(JSON.parse(flaky.getItem(MEANING_USE_STORAGE_KEY)).records[0].id === "use-1", "retry keeps the same id");

  const reloaded = stepFor(flaky, [t2]);
  const again = reloaded.offer(ready);
  check(again.offered === false && again.already === true, "reload does not ask to rate or write the sentence again");
  check(reloaded.finish().advance === true, "reload can continue from the saved sentence");

  const lost = memoryStorage();
  const draft = stepFor(lost);
  draft.offer(ready);
  draft.setText("The tide is high.");
  const other = stepFor(lost);
  check(other.offer(ready).offered === true, "an unsaved sentence is not on disk for another instance");
  check(lost.getItem(MEANING_USE_STORAGE_KEY) === null, "unsaved text was not uploaded or stored");
});

section("corrupt log, old phase, and clear", () => {
  const raw = "{";
  const storage = memoryStorage({
    [MEANING_USE_STORAGE_KEY]: raw,
    "echo-shards.round.v2:seed:meaning": "{\"version\":2}",
  });
  const step = stepFor(storage);
  const held = step.offer(ready);
  check(held.offered === false && held.message === MEANING_USE_HELD_MESSAGE, "corrupt log is explained and does not open over the recall");
  check(storage.getItem(MEANING_USE_STORAGE_KEY) === raw, "corrupt log is not overwritten");
  check(storage.getItem("echo-shards.round.v2:seed:meaning") === "{\"version\":2}", "recall round stays put");
  storage.setItem(MEANING_USE_STORAGE_KEY, JSON.stringify({ schema_version: 9, records: [] }));
  const future = stepFor(storage).offer(ready);
  check(future.offered === false && future.message === MEANING_USE_HELD_MESSAGE, "unknown schema is kept");
  check(storage.getItem(MEANING_USE_STORAGE_KEY).includes("\"schema_version\":9"), "unknown schema text stays");
  check(normalizeRoundPhase("use") === "use", "a saved sentence phase restores as sentence, not a new grade");
  check(normalizeRoundPhase("answer") === "answer", "old answer phase still restores");
  check(normalizeRoundPhase("nope") === "answer", "unknown round phase does not become a grade");
  const removed = clearPracticeRecords(storage);
  check(removed.includes(MEANING_USE_STORAGE_KEY), "clear removes the sentence log");
  check(storage.getItem(MEANING_USE_STORAGE_KEY) === null, "sentence log is actually gone");
});

section("review page uses the step", () => {
  const source = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(source.includes("createMeaningUseStep"), "review session owns the sentence step");
  check(source.includes("buildMeaningUseOffer"), "review session builds the ready-word offer");
  check(source.includes("meaningUseKeyAction"), "review session asks the step before using a key");
  check(source.includes("用这个词写一句"), "the sentence prompt is plain language");
});

if (failures.length > 0) {
  console.error(`assert-e3b-meaning-use-step: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e3b-meaning-use-step: ok");
