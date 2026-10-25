/**
 * Demo / assert: TideScheduler.restore integrity.
 * Honest snapshot round-trips; localStorage-style due tampering is rejected.
 * Run: npm run demo:restore
 */

import { TideRestoreError, TideScheduler } from "../scheduler/TideScheduler.js";

function expectThrow(label: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (err instanceof TideRestoreError) {
      console.log(`  OK reject: ${label} → ${err.message}`);
      return;
    }
    throw err;
  }
  throw new Error(`expected TideRestoreError for: ${label}`);
}

function main() {
  console.log("=== TideScheduler.restore integrity ===\n");

  const t0 = new Date("2026-10-25T02:00:00.000Z");
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const a = tide.enqueueNew("learner", { id: "lex_alpha" }, "form", t0);
  const b = tide.enqueueNew("learner", { id: "lex_beta" }, "form", t0);
  tide.enqueueNew("learner", { id: "lex_gamma" }, "meaning", t0);

  tide.rate(a.id, 3, new Date("2026-10-25T02:05:00.000Z"));
  tide.rate(a.id, 4, new Date("2026-10-25T03:00:00.000Z"));
  tide.rate(b.id, 2, new Date("2026-10-25T02:10:00.000Z"));

  const snap = tide.snapshot();
  const dueA = tide.getCard(a.id)!.review.due.getTime();
  const dueB = tide.getCard(b.id)!.review.due.getTime();

  const resumed = new TideScheduler({ requestRetention: 0.9 });
  resumed.restore(snap, new Date("2026-10-25T04:00:00.000Z"));
  if (resumed.getCard(a.id)!.review.due.getTime() !== dueA) {
    throw new Error("honest restore drifted card A due");
  }
  if (resumed.getCard(b.id)!.review.due.getTime() !== dueB) {
    throw new Error("honest restore drifted card B due");
  }
  if (resumed.getLogs().length !== snap.logs.length) {
    throw new Error("honest restore lost logs");
  }
  // Never-rated card rematerialized empty at restore `now` (still due).
  const gamma = resumed.getCard("learner:lex_gamma:meaning")!;
  if (gamma.review.reps !== 0 || gamma.review.state !== 0) {
    throw new Error("never-rated card should rematerialize as New");
  }
  console.log("  OK honest snapshot → restore (rated dues preserved, New rematerialized)");

  const empty = new TideScheduler({ requestRetention: 0.9 });
  empty.restore({ cards: [], logs: [] });
  if (empty.allCards().length !== 0 || empty.getLogs().length !== 0) {
    throw new Error("empty restore should clear");
  }
  console.log("  OK empty snapshot restore");

  // Tamper: push due far future while keeping forged reps/logs mismatched.
  const tamperedDue = structuredClone(
    JSON.parse(JSON.stringify(snap)) as { cards: Array<{ id: string; review: { due: string; reps: number } }>; logs: unknown[] },
  );
  const target = tamperedDue.cards.find((c) => c.id === a.id)!;
  target.review.due = "2099-01-01T00:00:00.000Z";
  expectThrow("forged due vs FSRS replay", () => {
    new TideScheduler({ requestRetention: 0.9 }).restore(tamperedDue);
  });

  const tamperedReps = structuredClone(
    JSON.parse(JSON.stringify(snap)) as {
      cards: Array<{ id: string; review: { reps: number; last_review?: string } }>;
      logs: unknown[];
    },
  );
  const repsCard = tamperedReps.cards.find((c) => c.id === a.id)!;
  repsCard.review.reps = 99;
  expectThrow("reps != log count", () => {
    new TideScheduler({ requestRetention: 0.9 }).restore(tamperedReps);
  });

  const orphan = structuredClone(
    JSON.parse(JSON.stringify(snap)) as { cards: unknown[]; logs: Array<Record<string, unknown>> },
  );
  orphan.logs.push({
    id: "log_orphan",
    card_id: "learner:missing:form",
    user_id: "learner",
    grade: 3,
    reviewed_at: "2026-10-25T05:00:00.000Z",
    state_before: 0,
    scheduled_days: 1,
  });
  expectThrow("orphan log", () => {
    new TideScheduler({ requestRetention: 0.9 }).restore(orphan);
  });

  // New-only forged due: rematerialize discards it (restore succeeds, due != forged).
  const newOnly = new TideScheduler({ requestRetention: 0.9 });
  const n = newOnly.enqueueNew("learner", { id: "lex_new" }, "form", t0);
  const newSnap = JSON.parse(JSON.stringify(newOnly.snapshot())) as {
    cards: Array<{ review: { due: string } }>;
    logs: unknown[];
  };
  newSnap.cards[0]!.review.due = "2099-06-01T00:00:00.000Z";
  const scrubbed = new TideScheduler({ requestRetention: 0.9 });
  const restoreAt = new Date("2026-10-25T06:00:00.000Z");
  scrubbed.restore(newSnap, restoreAt);
  const scrubbedDue = scrubbed.getCard(n.id)!.review.due.getTime();
  if (scrubbedDue === Date.parse("2099-06-01T00:00:00.000Z")) {
    throw new Error("forged New-card due should not survive rematerialize");
  }
  if (scrubbedDue !== restoreAt.getTime()) {
    throw new Error("rematerialized New card due should equal restore now");
  }
  console.log("  OK never-rated forged due rematerialized away");

  // Failed restore must not mutate an already-populated scheduler.
  const sticky = new TideScheduler({ requestRetention: 0.9 });
  sticky.restore(snap);
  const beforeIds = sticky.allCards().map((c) => c.id).sort().join("|");
  try {
    sticky.restore(tamperedDue);
    throw new Error("expected tampered restore to throw");
  } catch (err) {
    if (!(err instanceof TideRestoreError)) throw err;
  }
  const afterIds = sticky.allCards().map((c) => c.id).sort().join("|");
  if (beforeIds !== afterIds) {
    throw new Error("failed restore mutated cards");
  }
  if (sticky.getCard(a.id)!.review.due.getTime() !== dueA) {
    throw new Error("failed restore mutated due");
  }
  console.log("  OK failed restore leaves prior state intact");

  console.log("\nRestore OK.");
}

main();
