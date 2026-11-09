/**
 * E3a: deterministic form check for using a word in a sentence.
 * It must not rate cards or claim the meaning was judged.
 * Run: node --import tsx scripts/assert-e3a-meaning-use.mjs
 */
import { readFileSync } from "node:fs";
import {
  LOCAL_LEARNER_ID,
  TideScheduler,
  checkMeaningUse,
} from "../packages/core/src/index.ts";

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

function expect(result, verdict, reason, note) {
  check(result.verdict === verdict, `verdict ${verdict}, got ${result.verdict}`);
  check(result.reasons.includes(reason), `reason ${reason} missing in ${result.reasons.join(",")}`);
  check(result.learner_note === note, `note mismatch: ${result.learner_note}`);
  check(result.meaning_judged === false, "meaning_judged must stay false");
  check(result.semantic_status === "not_evaluated", "semantic status must stay not_evaluated");
  check(result.event_type === "meaning_use", "event type must be meaning_use");
  check(!Object.hasOwn(result, "grade"), "result must not carry an FSRS grade");
  check(!Object.hasOwn(result, "due"), "result must not carry due");
  check(!Object.hasOwn(result, "reps"), "result must not carry reps");
  check(!/学会|会用了|掌握/.test(result.learner_note), "note must not claim the word was learned");
}

section("basic boundaries", () => {
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "The tide is high.", enrichment_status: "ready" }),
    "basic_pass",
    "basic_form_ok",
    "这句话里有这个词。意思用得对不对，还没判断。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "See the TIDE!", enrichment_status: "ready" }),
    "basic_pass",
    "basic_form_ok",
    "这句话里有这个词。意思用得对不对，还没判断。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "   ", enrichment_status: "ready" }),
    "basic_fail",
    "empty",
    "先写一句再看。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "潮汐来了", enrichment_status: "ready" }),
    "basic_fail",
    "chinese_only",
    "这句还是中文。用英文把这个词写进去。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "The moon is bright.", enrichment_status: "ready" }),
    "basic_fail",
    "target_missing",
    "这句里还没有这个词。",
  );
  expect(
    checkMeaningUse({ lemma: "cat", sentence: "I catch the ball.", enrichment_status: "ready" }),
    "basic_fail",
    "target_inside_other_word",
    "看到了很像的拼写，但还不是这个词。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "Tide, tide!", enrichment_status: "ready" }),
    "basic_fail",
    "token_only",
    "只重复这个词还不算用上。再写几个别的词。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "...", enrichment_status: "ready" }),
    "basic_fail",
    "no_words",
    "先用英文写一句，把这个词放进去。",
  );
});

section("forms, function words, and readiness", () => {
  expect(
    checkMeaningUse({
      lemma: "tide",
      forms: ["tide", "tides"],
      sentence: "The tides turn.",
      enrichment_status: "ready",
    }),
    "basic_pass",
    "basic_form_ok",
    "这句话里有这个词。意思用得对不对，还没判断。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "The tides turn.", enrichment_status: "ready" }),
    "basic_fail",
    "target_inside_other_word",
    "看到了很像的拼写，但还不是这个词。",
  );
  expect(
    checkMeaningUse({ lemma: "to", sentence: "to the shop", enrichment_status: "ready" }),
    "basic_pass",
    "basic_form_ok",
    "这句话里有这个词。意思用得对不对，还没判断。",
  );
  expect(
    checkMeaningUse({ lemma: "to", sentence: "today", enrichment_status: "ready" }),
    "basic_fail",
    "target_inside_other_word",
    "看到了很像的拼写，但还不是这个词。",
  );
  expect(
    checkMeaningUse({ lemma: "to", sentence: "to", enrichment_status: "ready" }),
    "basic_fail",
    "token_only",
    "只重复这个词还不算用上。再写几个别的词。",
  );
  expect(
    checkMeaningUse({ lemma: "tide", sentence: "The tide is high.", enrichment_status: "pending" }),
    "not_assessable",
    "not_ready",
    "这个词还没准备好，先不拿来练。",
  );
  expect(
    checkMeaningUse({ lemma: "", sentence: "The tide is high." }),
    "not_assessable",
    "unknown_target",
    "还不知道要看哪个词。",
  );
  const huge = `The tide is high. ${"word ".repeat(80)}`;
  expect(
    checkMeaningUse({ lemma: "tide", sentence: huge, enrichment_status: "ready" }),
    "not_assessable",
    "overlong",
    "这句太长了，这次先不看。",
  );
  const odd = checkMeaningUse({ lemma: "tide", sentence: /** @type {string} */ (null) });
  expect(odd, "not_assessable", "unknown_target", "还不知道要看哪个词。");
});

section("pure and does not touch the scheduler", () => {
  const t0 = new Date("2026-10-25T01:00:00.000Z");
  const t1 = new Date("2026-10-25T02:00:00.000Z");
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  tide.rate(card.id, 3, t1, { clientEventId: "mem-1" });
  const before = JSON.stringify(tide.snapshot());
  const first = checkMeaningUse({ lemma: "tide", sentence: "The tide is high.", enrichment_status: "ready" });
  const second = checkMeaningUse({ lemma: "tide", sentence: "The tide is high.", enrichment_status: "ready" });
  check(JSON.stringify(first) === JSON.stringify(second), "same input returns the same result");
  check(JSON.stringify(tide.snapshot()) === before, "checking a sentence does not change due, reps, or logs");
  const source = readFileSync(new URL("../packages/core/src/meaning-use.ts", import.meta.url), "utf8");
  check(!source.includes("TideScheduler"), "meaning-use does not reference the scheduler");
  check(!source.includes(".rate("), "meaning-use does not call rate");
  check(!source.includes("retrieval_grade"), "meaning-use is not a retrieval grade");
  check(!source.includes("fetch(") && !source.includes("Date.now") && !source.includes("Math.random"), "no io, clock, or random");
  const page = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(!page.includes("checkMeaningUse"), "the review page is not wired yet");
});

if (failures.length > 0) {
  console.error(`assert-e3a-meaning-use: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e3a-meaning-use: ok");
