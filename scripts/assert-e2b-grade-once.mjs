/**
 * E2b: one shown card accepts one grade submission.
 * Clicks and hotkeys share createGradeSubmitter; the second call must not rate.
 * Run: node --import tsx scripts/assert-e2b-grade-once.mjs
 */
import { readFileSync } from "node:fs";
import { AgentEventLog, TideScheduler, TideSteward } from "../packages/core/src/index.ts";
import {
  createGradeSubmitter,
  gradeFromHotkey,
} from "../apps/web/src/lib/grade-submit.ts";

const failures = [];

function check(cond, message) {
  if (!cond) failures.push(message);
}

function section(name, run) {
  try {
    run();
  } catch (error) {
    failures.push(
      `${name} threw: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    );
  }
}

function harness(nowValues, idPrefix = "grade") {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const steward = new TideSteward(tide, new AgentEventLog());
  const t0 = new Date("2026-10-25T01:00:00.000Z");
  const cardA = tide.enqueueNew("learner-a", { id: "en_tide" }, "meaning", t0);
  const cardB = tide.enqueueNew("learner-a", { id: "en_echo" }, "meaning", t0);
  let clock = 0;
  let ids = 0;
  const persists = [];
  const submitter = createGradeSubmitter({
    now: () => nowValues[Math.min(clock++, nowValues.length - 1)],
    newId: () => `${idPrefix}-${++ids}`,
  });
  let failPersist = false;
  function persist() {
    if (failPersist) throw new Error("disk full");
    persists.push(tide.snapshot());
  }
  function rate(attempt) {
    check(!("due" in attempt), "grade attempt must not carry due");
    return steward.rate(attempt.cardId, attempt.grade, attempt.reviewedAt, {
      client_event_id: attempt.clientEventId,
    });
  }
  return { tide, cardA, cardB, submitter, persist, rate, persists, setFailPersist: (value) => { failPersist = value; } };
}

const t1 = new Date("2026-10-25T02:00:00.000Z");
const t2 = new Date("2026-10-25T02:00:05.000Z");
const t3 = new Date("2026-10-25T02:00:09.000Z");

section("double click and hotkey", () => {
  const { tide, cardA, submitter, persist, rate } = harness([t1, t2, t3]);
  submitter.show(cardA.id);
  const first = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  const due = tide.getCard(cardA.id).review.due.getTime();
  const second = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  const fromKey = gradeFromHotkey("3");
  check(fromKey === 3, "hotkey 3 is grade 3");
  const third = submitter.submit({ cardId: cardA.id, grade: fromKey, rate, persist });
  check(first.status === "saved" && first.advanced === true && first.saved === true, "first click saves once");
  check(first.clientEventId === "grade-1", "first attempt id");
  check(second.status === "already-submitted" && second.advanced === false, "second click does not advance");
  check(third.status === "already-submitted", "hotkey repeat does not submit again");
  check(tide.getCard(cardA.id).review.reps === 1, "double submit keeps reps at 1");
  check(tide.getLogs().length === 1, "double submit keeps one review log");
  check(tide.getLogs()[0].reviewed_at.getTime() === t1.getTime(), "reviewed_at stays the first clock");
  check(tide.getLogs()[0].client_event_id === "grade-1", "log uses the submitter id");
  check(tide.getCard(cardA.id).review.due.getTime() === due, "second click does not move due");
  check(gradeFromHotkey("Enter") === null && gradeFromHotkey("5") === null, "unmapped keys do not invent a grade");
});

section("re-entry while rating", () => {
  const { tide, cardA, submitter, persist } = harness([t1, t2]);
  submitter.show(cardA.id);
  let inner = null;
  const first = submitter.submit({
    cardId: cardA.id,
    grade: 4,
    persist,
    rate: (attempt) => {
      inner = submitter.submit({ cardId: cardA.id, grade: 4, rate: () => { throw new Error("nested rate"); }, persist });
      const steward = new TideSteward(tide, new AgentEventLog());
      return steward.rate(attempt.cardId, attempt.grade, attempt.reviewedAt, {
        client_event_id: attempt.clientEventId,
      });
    },
  });
  check(inner?.status === "already-inflight", "re-entry during rate is inflight, not a second grade");
  check(first.status === "saved", "outer submit still saves");
  check(tide.getLogs().length === 1 && tide.getCard(cardA.id).review.reps === 1, "re-entry does not rate twice");
});

section("different grade is not the next card", () => {
  const { tide, cardA, cardB, submitter, persist, rate } = harness([t1, t2, t3]);
  submitter.show(cardA.id);
  submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  const other = submitter.submit({ cardId: cardA.id, grade: 1, rate, persist });
  check(other.status === "already-submitted" && other.advanced === false, "other grade on the same card does not advance");
  check(tide.getCard(cardA.id).review.reps === 1, "other grade does not rate");
  check(tide.getCard(cardB.id).review.reps === 0, "other grade does not touch the next card");
});

section("stale callback and next card", () => {
  const { tide, cardA, cardB, submitter, persist, rate } = harness([t1, t2, t3]);
  submitter.show(cardA.id);
  const saved = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  submitter.show(cardB.id);
  const stale = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  check(stale.status === "stale" && stale.advanced === false, "old card callback is stale after the next card is shown");
  check(tide.getLogs().length === 1, "stale callback appends no log");
  const next = submitter.submit({ cardId: cardB.id, grade: 2, rate, persist });
  check(next.status === "saved" && next.clientEventId !== saved.clientEventId, "next card gets a new id");
  check(tide.getCard(cardB.id).review.reps === 1, "next card rates once");
  check(tide.getLogs().map((log) => log.client_event_id).join() === "grade-1,grade-2", "ids stay distinct");
});

section("rate failure keeps identity", () => {
  const { tide, submitter, persist, rate } = harness([t1, t2, t3]);
  const missing = "learner-a:en_missing:meaning";
  submitter.show(missing);
  const failed = submitter.submit({ cardId: missing, grade: 3, rate, persist });
  check(failed.status === "rate-failed" && failed.saved === false && failed.advanced === false, "missing card is not saved");
  check(tide.getLogs().length === 0, "failed rate writes no log");
  const locked = submitter.submit({ cardId: missing, grade: 1, rate, persist });
  check(locked.status === "grade-locked", "a different grade does not replace the failed attempt");
  check(tide.getLogs().length === 0, "locked grade does not rate");
  const card = tide.enqueueNew("learner-a", { id: "en_missing" }, "meaning", t1);
  const retried = submitter.submit({ cardId: missing, grade: 3, rate, persist });
  check(retried.status === "saved", "same grade retries");
  check(retried.clientEventId === failed.clientEventId, "retry keeps client_event_id");
  check(tide.getLogs()[0].reviewed_at.getTime() === t1.getTime(), "retry keeps the original reviewed_at");
  check(tide.getCard(card.id).review.reps === 1, "retry rates once");
  check(String(failed.error || "").length > 0, "rate failure is visible");
});

section("save failure then retry", () => {
  const { tide, cardA, submitter, persist, rate, persists, setFailPersist } = harness([t1, t2, t3]);
  submitter.show(cardA.id);
  setFailPersist(true);
  const failed = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  check(failed.status === "save-failed" && failed.saved === false && failed.advanced === false, "disk failure is not reported as saved");
  check(tide.getCard(cardA.id).review.reps === 1, "the grade remains in memory");
  check(persists.length === 0, "failed disk write stores nothing");
  check(String(failed.error || "").includes("disk full"), "disk error is not swallowed");
  setFailPersist(false);
  const again = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  check(again.status === "saved" && again.advanced === true && again.replayed === true, "retry persists the same rate");
  check(again.clientEventId === failed.clientEventId, "save retry keeps the id");
  check(tide.getLogs().length === 1, "save retry does not append a log");
  check(tide.getLogs()[0].reviewed_at.getTime() === t1.getTime(), "save retry does not change reviewed_at");
  check(persists.length === 1, "successful retry writes once");
});

section("fresh instance after a lost save", () => {
  const { tide, cardA, submitter, persist, rate, setFailPersist } = harness([t1, t2]);
  submitter.show(cardA.id);
  setFailPersist(true);
  const failed = submitter.submit({ cardId: cardA.id, grade: 3, rate, persist });
  check(failed.saved === false, "unmount premise: save was not acknowledged");
  const restarted = harness([t3], "reload");
  restarted.submitter.show(restarted.cardA.id);
  const neon = restarted.submitter.submit({
    cardId: restarted.cardA.id,
    grade: 3,
    rate: restarted.rate,
    persist: restarted.persist,
  });
  check(neon.replayed === false && neon.clientEventId === "reload-1", "a new page load mints a new attempt instead of reusing the lost one");
  check(neon.clientEventId !== failed.clientEventId, "the reloaded attempt is a different id");
  check(restarted.tide.getLogs().length === 1, "the new attempt can rate because disk never stored the first");
  check(tide.getLogs().length === 1, "the abandoned page still holds its single in-memory grade");
});

section("review session uses the submitter", () => {
  const source = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(source.includes("createGradeSubmitter"), "review session constructs the submitter");
  check(source.includes("gradeFromHotkey"), "review session routes hotkeys through the same grade map");
  check(source.includes("submitterRef.current.submit"), "confirm path calls submit");
  check(!source.includes("steward.rate(prompt.card_id, grade, new Date())"), "confirm no longer rates with a fresh clock");
});

if (failures.length > 0) {
  console.error(`assert-e2b-grade-once: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e2b-grade-once: ok");
