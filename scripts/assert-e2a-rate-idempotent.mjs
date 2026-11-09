/**
 * E2a: client_event_id makes one grade submission idempotent inside TideScheduler.
 * The id lives on the review log that snapshot/restore already keeps.
 * Run: node --import tsx scripts/assert-e2a-rate-idempotent.mjs
 */
import {
  AgentEventLog,
  SchedulePolicyError,
  TideRestoreError,
  TideScheduler,
  TideSteward,
} from "../packages/core/src/index.ts";

const failures = [];

function check(cond, message) {
  if (!cond) failures.push(message);
}

function section(name, run) {
  try {
    run();
  } catch (error) {
    failures.push(`${name} threw before finishing: ${error instanceof Error ? error.name + ": " + error.message : String(error)}`);
  }
}

function finger(card) {
  const review = card.review;
  return JSON.stringify({
    reps: review.reps,
    due: review.due.getTime(),
    stability: review.stability,
    difficulty: review.difficulty,
    scheduled_days: review.scheduled_days,
    elapsed_days: review.elapsed_days,
    lapses: review.lapses,
    state: review.state,
    last_review: review.last_review ? review.last_review.getTime() : null,
  });
}

function open(tide, userId, lexemeId, aspect, when) {
  return tide.enqueueNew(userId, { id: lexemeId }, aspect, when);
}

const t0 = new Date("2026-10-25T01:00:00.000Z");
const t1 = new Date("2026-10-25T02:00:00.000Z");
const t2 = new Date("2026-10-25T03:00:00.000Z");
const t3 = new Date("2026-10-25T04:00:00.000Z");

function fresh(userId = "learner-a") {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const card = open(tide, userId, "en_tide", "meaning", t0);
  return { tide, card };
}

// --- first submit, then the same payload again ---
section("first submit", () => {
  const { tide, card } = fresh();
  const first = tide.rate(card.id, 3, t1, { clientEventId: "submit-1" });
  const before = finger(tide.getCard(card.id));
  const logCount = tide.getLogs().length;
  check(first.replayed !== true, "first submit must not be marked replayed");
  check(tide.getCard(card.id).review.reps === 1, "first submit reps === 1");
  check(tide.getLogs()[0]?.client_event_id === "submit-1", "log stores client_event_id");
  check(tide.requestRetention === 0.9, "FSRS requestRetention stays 0.9");

  const second = tide.rate(card.id, 3, t1, { clientEventId: "submit-1" });
  check(second.replayed === true, "same payload must be a replay, not a new rate");
  check(second.log.id === first.log.id, "replay returns the original review log");
  check(finger(tide.getCard(card.id)) === before, "replay must not change schedule state");
  check(tide.getLogs().length === logCount, "replay must not append a review log");
});

// --- same id, different payload ---
section("conflict", () => {
  const { tide, card } = fresh();
  tide.rate(card.id, 3, t1, { clientEventId: "submit-conflict" });
  const before = finger(tide.getCard(card.id));
  const logsBefore = tide.getLogs().length;
  const cases = [
    ["different grade", () => tide.rate(card.id, 1, t1, { clientEventId: "submit-conflict" })],
    ["different clock", () => tide.rate(card.id, 3, t2, { clientEventId: "submit-conflict" })],
    [
      "different card",
      () => {
        const other = open(tide, "learner-a", "en_echo", "meaning", t0);
        return tide.rate(other.id, 3, t1, { clientEventId: "submit-conflict" });
      },
    ],
  ];
  for (const [label, run] of cases) {
    let threw = false;
    let name = "";
    try {
      run();
    } catch (error) {
      threw = true;
      name = error instanceof Error ? error.name : "";
    }
    check(threw, `${label} must throw`);
    check(name === "TideEventConflictError", `${label} must be TideEventConflictError, got ${name || "(no throw)"}`);
    check(finger(tide.getCard(card.id)) === before, `${label} must leave the original card unchanged`);
    check(tide.getLogs().length === logsBefore, `${label} must not append a log`);
  }
});

// --- another id is a real second grade ---
section("distinct ids", () => {
  const { tide, card } = fresh();
  tide.rate(card.id, 3, t1, { clientEventId: "submit-a" });
  const midDue = tide.getCard(card.id).review.due.getTime();
  tide.rate(card.id, 4, t2, { clientEventId: "submit-b" });
  check(tide.getCard(card.id).review.reps === 2, "distinct ids both rate");
  check(tide.getLogs().length === 2, "distinct ids append two logs");
  check(tide.getCard(card.id).review.due.getTime() !== midDue, "second id moves due");
  const again = tide.rate(card.id, 3, t1, { clientEventId: "submit-a" });
  check(again.replayed === true, "earlier id still replays after a later grade");
  check(tide.getCard(card.id).review.reps === 2, "replaying the earlier id does not add a rep");
  check(
    tide.getCard(card.id).review.due.getTime() !== midDue,
    "replaying the earlier id does not roll due back",
  );
});

// --- id namespace: learner, and a scheduler that was not restored ---
section("id scope", () => {
  const left = fresh("learner-a");
  const right = fresh("learner-b");
  left.tide.rate(left.card.id, 3, t1, { clientEventId: "shared-label" });
  right.tide.rate(right.card.id, 3, t1, { clientEventId: "shared-label" });
  check(
    left.tide.getCard(left.card.id).review.reps === 1 &&
      right.tide.getCard(right.card.id).review.reps === 1,
    "same id on two schedulers both apply once",
  );
  const third = fresh("learner-a");
  third.tide.rate(third.card.id, 1, t2, { clientEventId: "shared-label" });
  check(
    third.tide.getCard(third.card.id).review.reps === 1,
    "a new scheduler does not inherit another instance's ids",
  );
  check(left.tide.getCard(left.card.id).review.reps === 1, "the other instance stays at one rep");
});

// --- omitted id keeps today's behavior; blank id is rejected and does not stick ---
section("blank id", () => {
  const { tide, card } = fresh();
  tide.rate(card.id, 3, t1);
  tide.rate(card.id, 3, t2);
  check(tide.getCard(card.id).review.reps === 2, "omitted client_event_id still rates every call");
  check(tide.getLogs().every((log) => log.client_event_id === undefined), "omitted id is not stored");

  const before = finger(tide.getCard(card.id));
  const logsBefore = tide.getLogs().length;
  for (const blank of ["", "   ", " submit "]) {
    let name = "";
    try {
      tide.rate(card.id, 4, t3, { clientEventId: blank });
    } catch (error) {
      name = error instanceof Error ? error.name : "";
    }
    check(name === "TideEventConflictError", `blank id ${JSON.stringify(blank)} must be TideEventConflictError, got ${name || "(no throw)"}`);
  }
  let longName = "";
  try {
    tide.rate(card.id, 4, t3, { clientEventId: "x".repeat(129) });
  } catch (error) {
    longName = error instanceof Error ? error.name : "";
  }
  check(longName === "TideEventConflictError", "over-long id must be rejected");
  check(finger(tide.getCard(card.id)) === before, "rejected ids must not change the card");
  check(tide.getLogs().length === logsBefore, "rejected ids must not append a log");
  tide.rate(card.id, 4, t3, { clientEventId: "after-blanks" });
  check(tide.getCard(card.id).review.reps === 3, "a later valid id still rates after rejected blanks");
});

// --- failed rate does not consume the id ---
section("failed retry", () => {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  let name = "";
  try {
    tide.rate("learner-a:en_missing:meaning", 3, t1, { clientEventId: "retry-1" });
  } catch (error) {
    name = error instanceof Error ? error.name : "";
  }
  check(name === "Error", `missing card throws before success, got ${name || "(no throw)"}`);
  check(tide.getLogs().length === 0, "failed rate appends no log");
  const card = open(tide, "learner-a", "en_missing", "meaning", t0);
  const rated = tide.rate(card.id, 3, t1, { clientEventId: "retry-1" });
  check(rated.replayed !== true, "id from a failed attempt can be used by the successful retry");
  check(tide.getCard(card.id).review.reps === 1, "successful retry rates once");
  const replay = tide.rate(card.id, 3, t1, { clientEventId: "retry-1" });
  check(
    replay.replayed === true && tide.getCard(card.id).review.reps === 1,
    "retry then replay stays at one rep",
  );
});

// --- same input order survives snapshot/restore; duplicate id still replays ---
section("restore", () => {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const meaning = open(tide, "learner-a", "en_shard", "meaning", t0);
  const form = open(tide, "learner-a", "en_shard", "form", t0);
  const steps = [
    [meaning.id, 3, t1, "ord-1"],
    [form.id, 2, t2, "ord-2"],
    [meaning.id, 4, t3, "ord-3"],
  ];
  for (const [cardId, grade, when, id] of steps) {
    tide.rate(cardId, grade, when, { clientEventId: id });
  }
  const beforeMeaning = finger(tide.getCard(meaning.id));
  const beforeForm = finger(tide.getCard(form.id));
  const snap = tide.snapshot();
  const resumed = new TideScheduler({ requestRetention: 0.9 });
  resumed.restore(structuredClone(snap), new Date("2026-10-26T00:00:00.000Z"));
  check(finger(resumed.getCard(meaning.id)) === beforeMeaning, "restore replays meaning to the same schedule");
  check(finger(resumed.getCard(form.id)) === beforeForm, "restore replays form to the same schedule");
  check(
    resumed.getLogs().map((log) => log.client_event_id).join() === "ord-1,ord-2,ord-3",
    "restore keeps client_event_id order",
  );
  const replay = resumed.rate(meaning.id, 3, t1, { clientEventId: "ord-1" });
  check(replay.replayed === true, "restored scheduler still replays the same id");
  check(finger(resumed.getCard(meaning.id)) === beforeMeaning, "replay after restore does not move due");
  check(resumed.getLogs().length === 3, "replay after restore appends no log");

  const forged = structuredClone(snap);
  forged.cards.find((row) => row.id === meaning.id).review.due = "2099-01-01T00:00:00.000Z";
  let restoreName = "";
  try {
    new TideScheduler({ requestRetention: 0.9 }).restore(forged);
  } catch (error) {
    restoreName = error instanceof Error ? error.name : "";
  }
  check(restoreName === "TideRestoreError", "snapshot due is still not authoritative");
  check(typeof TideRestoreError === "function", "TideRestoreError still exported");

  const duplicated = structuredClone(snap);
  duplicated.logs[1].client_event_id = duplicated.logs[0].client_event_id;
  let dupName = "";
  try {
    new TideScheduler({ requestRetention: 0.9 }).restore(duplicated);
  } catch (error) {
    dupName = error instanceof Error ? error.name : "";
  }
  check(dupName === "TideRestoreError", "duplicate client_event_id in a snapshot is corrupt");
});

// --- steward envelope: one stable event, schedule fields still rejected ---
section("steward", () => {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const log = new AgentEventLog();
  const steward = new TideSteward(tide, log);
  const card = open(tide, "learner-a", "en_elicit", "meaning", t0);
  const first = steward.rate(card.id, 3, t1, { client_event_id: "env-1" });
  check(first.replayed !== true, "steward first submit is not a replay");
  check(log.events.length === 1, "steward records one retrieval event");
  check(log.events[0]?.id === "retrieval:env-1", "event id is derived from client_event_id");
  check(log.events[0]?.payload.client_event_id === "env-1", "event payload carries client_event_id");
  check(log.events[0]?.payload.source === "TideScheduler.rate", "due echo still comes from rate");
  const eventDue = log.events[0]?.payload.due;
  const before = finger(tide.getCard(card.id));
  const second = steward.rate(card.id, 3, t1, { client_event_id: "env-1" });
  check(second.replayed === true, "steward replay flag");
  check(log.events.length === 1, "steward replay does not append an event");
  check(log.runs.length === 1, "steward replay does not append an agent run");
  check(finger(tide.getCard(card.id)) === before, "steward replay does not change the card");
  check(log.events[0]?.payload.due === eventDue, "replay does not rewrite the stored due echo");

  const eventsBefore = log.events.length;
  const logsBefore = tide.getLogs().length;
  let policyName = "";
  try {
    steward.rate(card.id, 3, t2, { client_event_id: "env-due", due: "2099-01-01T00:00:00.000Z" });
  } catch (error) {
    policyName = error instanceof Error ? error.name : "";
  }
  check(policyName === "SchedulePolicyError", `due payload stays SchedulePolicyError, got ${policyName || "(no throw)"}`);
  check(errorNameIsPolicy(SchedulePolicyError), "SchedulePolicyError still exported");
  check(log.events.length === eventsBefore, "rejected due payload records no success event");
  check(tide.getLogs().length === logsBefore, "rejected due payload does not rate");
  steward.rate(card.id, 1, t2, { client_event_id: "env-due" });
  check(tide.getCard(card.id).review.reps === 2, "id blocked by a due payload can still be used");

  const savedTide = tide.snapshot();
  const savedEvents = log.snapshot();
  const tide2 = new TideScheduler({ requestRetention: 0.9 });
  const log2 = new AgentEventLog();
  tide2.restore(structuredClone(savedTide));
  log2.restore(savedEvents);
  const steward2 = new TideSteward(tide2, log2);
  steward2.rate(card.id, 3, t1, { client_event_id: "env-1" });
  check(log2.events.length === savedEvents.events.length, "restored event log does not grow on replay");
  check(tide2.getLogs().length === savedTide.logs.length, "restored tide does not grow on replay");
});

function errorNameIsPolicy(ctor) {
  return ctor?.name === "SchedulePolicyError";
}

if (failures.length > 0) {
  console.error(`assert-e2a-rate-idempotent: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e2a-rate-idempotent: ok");
