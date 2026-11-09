/**
 * E5a: recorded JSON fixtures may add a comment. They cannot change the
 * basic meaning-use check, rate a card, or claim the meaning was judged.
 * Run: node --import tsx scripts/assert-e5a-fixture-model.mjs
 */
import { readFileSync } from "node:fs";
import {
  LOCAL_LEARNER_ID,
  TideScheduler,
  AgentEventLog,
  checkMeaningUse,
  runFixtureMeaningComment,
  MEANING_USE_COMMENT_PROMPT_VERSION,
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

const PROMPT = "meaning-use-comment/v1";
const LABEL = "test-fixture-not-learner-data";

function validBody(extra = {}) {
  return {
    schema_version: 1,
    prompt_version: PROMPT,
    task: "meaning_use_comment",
    simulation: "recorded-json",
    fixture: true,
    fixture_label: LABEL,
    lemma: "tide",
    sentence: "The tide is high.",
    comment: "测试夹具：只多一句说明，不判断意思。",
    ...extra,
  };
}

function sourceFrom(produce) {
  const counts = { open: 0, complete: 0, release: 0 };
  return {
    counts,
    simulation: "recorded-json",
    open() {
      counts.open += 1;
    },
    complete() {
      counts.complete += 1;
      return produce();
    },
    release() {
      counts.release += 1;
    },
  };
}

function run(sentence, produce, extra = {}) {
  const source = sourceFrom(produce);
  const result = runFixtureMeaningComment({
    lemma: "tide",
    sentence,
    enrichment_status: "ready",
    promptVersion: PROMPT,
    source,
    now: extra.now ?? (() => 0),
    timeoutMs: extra.timeoutMs ?? 8000,
    maxAttempts: extra.maxAttempts,
    signal: extra.signal,
  });
  return { result, source };
}

section("valid fixture stays inside the basic check", () => {
  const book = JSON.parse(
    readFileSync(new URL("../packages/core/fixtures/meaning-use-comment.v1.json", import.meta.url), "utf8"),
  );
  check(book.simulation === "recorded-json", "fixture book is marked recorded-json");
  check(book.label === LABEL, "fixture book is labeled as test data");
  check(book.prompt_version === MEANING_USE_COMMENT_PROMPT_VERSION, "prompt version is pinned");
  const { result, source } = run("The tide is high.", () => JSON.stringify(book.cases["valid-comment"]));
  const baseline = checkMeaningUse({
    lemma: "tide",
    sentence: "The tide is high.",
    enrichment_status: "ready",
  });
  check(result.model_judgment === "fixture_comment_only", "accepted fixture is marked as a comment only");
  check(result.fixture_comment === "测试夹具：只多一句说明，不判断意思。", "comment is the fixture text");
  check(result.fallback_reason === null, "valid fixture has no fallback");
  check(JSON.stringify(result.baseline) === JSON.stringify(baseline), "baseline check is unchanged");
  check(result.baseline.meaning_judged === false && result.baseline.semantic_status === "not_evaluated", "meaning stays unevaluated");
  check(result.baseline.verdict === "basic_pass", "fixture cannot invent a stronger verdict");
  check(!Object.hasOwn(result, "due") && !Object.hasOwn(result, "grade"), "adapter result has no schedule fields");
  check(source.counts.open === 1 && source.counts.complete === 1 && source.counts.release === 1, "source is opened, used, and released");
  const again = run("The tide is high.", () => JSON.stringify(book.cases["valid-comment"]));
  check(JSON.stringify(again.result) === JSON.stringify(result), "same fixture is deterministic");
});

section("bad fixtures fall back without changing the check", () => {
  const cases = [
    ["invalid json", () => "{", "invalid_json"],
    ["missing comment", () => JSON.stringify({ ...validBody(), comment: undefined }), "schema"],
    ["comment type", () => JSON.stringify(validBody({ comment: 12 })), "schema"],
    ["comment too long", () => JSON.stringify(validBody({ comment: "测试夹具：" + "啊".repeat(80) })), "schema"],
    ["extra due", () => JSON.stringify(validBody({ due: "2099-01-01T00:00:00.000Z" })), "unauthorized_field"],
    ["rate command", () => JSON.stringify(validBody({ tool: "rate" })), "unauthorized_field"],
    ["mastery claim", () => JSON.stringify(validBody({ comment: "测试夹具：你已经学会了" })), "schema"],
    ["wrong lemma", () => JSON.stringify(validBody({ lemma: "ship" })), "schema"],
    ["timeout", () => { throw Object.assign(new Error("slow"), { name: "FixtureTimeout" }); }, "timeout"],
    ["refusal", () => { throw Object.assign(new Error("no"), { name: "FixtureRefusal" }); }, "refused"],
    ["throw", () => { throw new Error("boom"); }, "error"],
  ];
  for (const [label, produce, reason] of cases) {
    const { result, source } = run("The tide is high.", produce);
    check(result.model_judgment === "not_obtained", `${label} does not claim a model judgment`);
    check(result.fallback_reason === reason, `${label} reason ${reason}, got ${result.fallback_reason}`);
    check(result.fixture_comment === null, `${label} does not keep the model text`);
    check(result.baseline.verdict === "basic_pass" && result.baseline.meaning_judged === false, `${label} keeps the basic pass`);
    check(source.counts.release === source.counts.open, `${label} releases what it opened`);
  }
});

section("model cannot upgrade a failure or a pending word", () => {
  const chinese = run("潮汐来了", () => JSON.stringify(validBody({ sentence: "潮汐来了" })));
  check(chinese.source.counts.complete === 0, "a failed basic check does not consult the fixture");
  check(chinese.result.baseline.verdict === "basic_fail", "Chinese stays a basic failure");
  check(chinese.result.model_judgment === "not_obtained", "no model judgment on a basic failure");
  const pending = runFixtureMeaningComment({
    lemma: "tide",
    sentence: "The tide is high.",
    enrichment_status: "pending",
    promptVersion: PROMPT,
    source: sourceFrom(() => JSON.stringify(validBody())),
    now: () => 0,
    timeoutMs: 8000,
  });
  check(pending.baseline.reasons.includes("not_ready"), "pending word is not assessed");
  check(pending.model_judgment === "not_obtained" && pending.fallback_reason === "not_ready", "pending word skips the fixture");
});

section("cancel, clock, and attempt cap", () => {
  const signal = { cancelled: false };
  const source = sourceFrom(() => JSON.stringify(validBody()));
  source.open = () => {
    source.counts.open += 1;
    signal.cancelled = true;
  };
  const cancelled = runFixtureMeaningComment({
    lemma: "tide",
    sentence: "The tide is high.",
    enrichment_status: "ready",
    promptVersion: PROMPT,
    source,
    now: () => 0,
    timeoutMs: 8000,
    signal,
  });
  check(cancelled.fallback_reason === "cancelled", "cancel after open stops the fixture");
  check(source.counts.complete === 0 && source.counts.release === 1, "cancel still releases the source");

  let tick = 0;
  const slow = run("The tide is high.", () => JSON.stringify(validBody()), {
    now: () => {
      tick += 9000;
      return tick;
    },
    timeoutMs: 8000,
  });
  check(slow.result.fallback_reason === "timeout" && slow.result.fixture_comment === null, "injected clock marks timeout without sleeping");

  const noisy = sourceFrom(() => {
    throw new Error("again");
  });
  const capped = runFixtureMeaningComment({
    lemma: "tide",
    sentence: "The tide is high.",
    enrichment_status: "ready",
    promptVersion: PROMPT,
    source: noisy,
    now: () => 0,
    timeoutMs: 8000,
    maxAttempts: 100,
  });
  check(noisy.counts.complete === 2, "attempts are capped at 2");
  check(capped.attempts === 2 && capped.fallback_reason === "error", "cap ends in the deterministic fallback");
  check(noisy.counts.release === noisy.counts.open, "each opened attempt is released");
});

section("schedule and memory stay put", () => {
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", new Date("2026-10-25T01:00:00.000Z"));
  tide.rate(card.id, 3, new Date("2026-10-25T02:00:00.000Z"), { clientEventId: "recall-1" });
  const log = new AgentEventLog();
  log.recordEvent({ event_type: "retrieval_grade", payload: { grade: 3 } });
  const beforeTide = JSON.stringify(tide.snapshot());
  const beforeLog = JSON.stringify(log.snapshot());
  const malicious = run("The tide is high.", () => JSON.stringify(validBody({ due: "2099-01-01T00:00:00.000Z", tool: "rate" })));
  check(malicious.result.fallback_reason === "unauthorized_field", "due and tool fields are rejected");
  check(JSON.stringify(tide.snapshot()) === beforeTide, "rejected fixture does not change due or reps");
  check(JSON.stringify(log.snapshot()) === beforeLog, "fixture does not write memory or xp events");
  const source = readFileSync(new URL("../packages/core/src/fixture-model.ts", import.meta.url), "utf8");
  check(!source.includes("TideScheduler") && !source.includes(".rate("), "adapter cannot rate");
  check(!source.includes("fetch(") && !source.includes("setTimeout") && !source.includes("process.env"), "adapter has no network, sleep, or secrets");
  const page = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(!page.includes("runFixtureMeaningComment"), "learner page does not call the fixture adapter");
});

if (failures.length > 0) {
  console.error(`assert-e5a-fixture-model: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e5a-fixture-model: ok");
