/**
 * E8a: a pronunciation experiment score cannot become a memory grade.
 * Writing IPA on the phonology_text card is still a normal retrieval.
 * Run: node --import tsx scripts/assert-e8a-pronunciation-boundary.mjs
 */
import { readFileSync } from "node:fs";
import {
  LOCAL_LEARNER_ID,
  AgentEventLog,
  TideScheduler,
  TideSteward,
  SchedulePolicyError,
  assistGrade,
  WORD_TIDE_CONFIG,
  deriveAspectUnlockState,
  progressFromEvents,
  summarizeLearningEvidence,
  pronunciationScoreToGrade,
  recordPronunciationExperiment,
  PronunciationScheduleError,
  PRONUNCIATION_EXPERIMENT_VERSION,
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

const LABEL = "test-fixture-not-learner-speech";
const fixture = JSON.parse(
  readFileSync(new URL("../packages/core/fixtures/pronunciation-experiment.v1.json", import.meta.url), "utf8"),
);

function sample(extra = {}) {
  return { ...fixture, client_event_id: "speech-1", ...extra };
}

function harness() {
  const t0 = new Date("2026-10-20T04:00:00.000Z");
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const log = new AgentEventLog();
  const steward = new TideSteward(tide, log);
  const meaning = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  const phonology = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "phonology_text", t0);
  return { t0, tide, log, steward, meaning, phonology };
}

function throws(run) {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

section("fixture is an experiment sample, not a measured voice", () => {
  check(PRONUNCIATION_EXPERIMENT_VERSION === 1, "experiment version is 1");
  check(fixture.fixture === true, "fixture flag");
  check(fixture.fixture_label === LABEL, "fixture label");
  check(fixture.source === "recorded-fixture", "source is a recorded fixture");
  check(fixture.task === "pronunciation_experiment", "task name");
  check(fixture.score === 72, "sample score");
  check(!JSON.stringify(fixture).includes("准确率"), "fixture does not claim acoustic accuracy");
});

section("a valid score is stored aside and does not schedule", () => {
  const { tide, log, meaning } = harness();
  const beforeTide = JSON.stringify(tide.snapshot());
  const beforeUnlock = deriveAspectUnlockState("en_tide", "phonology_text", tide.getLogs());
  const recorded = recordPronunciationExperiment(sample(), log);
  check(recorded.event_type === "pronunciation_experiment", "separate event type");
  check(recorded.score === 72, "score kept");
  check(recorded.mastery === false, "not mastery");
  check(recorded.acoustic_accuracy === "not_measured", "no invented accuracy");
  check(recorded.schedules === false, "does not schedule");
  check(recorded.accepted_as_grade === false, "not a grade");
  check(recorded.schema_version === 1, "stored version");
  check(log.events.length === 1, "one experiment event");
  check(log.events[0].event_type === "pronunciation_experiment", "log type");
  check(!log.events.some((event) => event.event_type === "retrieval_grade"), "no retrieval event");
  check(tide.getLogs().length === 0, "no review log");
  check(JSON.stringify(tide.snapshot()) === beforeTide, "due and reps stay put");
  check(tide.getCard(meaning.id).review.reps === 0, "meaning reps stay 0");
  check(
    deriveAspectUnlockState("en_tide", "phonology_text", tide.getLogs()) === beforeUnlock,
    "unlock snapshot stays",
  );
  check(beforeUnlock === "locked", "phonology stays locked");
  const progress = progressFromEvents({ events: log.events, now: new Date("2026-10-20T04:00:00.000Z") });
  check(progress.xp === 0, "experiment score adds no xp");
  check(progress.retrieval_count === 0, "experiment score is not a retrieval");
  const evidence = summarizeLearningEvidence({ events: log.events });
  check(evidence.delayed_retrieval.ratio === null, "experiment score is not delayed remembering");
  check(evidence.activity.retrieval_submissions === 0, "experiment score is not a click");
});

section("extremes, replay, and conflict", () => {
  const low = harness();
  const lowRow = recordPronunciationExperiment(sample({ score: 0, client_event_id: "low" }), low.log);
  const high = harness();
  const highRow = recordPronunciationExperiment(sample({ score: 100, client_event_id: "high" }), high.log);
  check(lowRow.score === 0 && highRow.score === 100, "0 and 100 are in range");
  check(lowRow.mastery === false && highRow.mastery === false, "extremes are still not mastery");

  const { log, tide } = harness();
  const first = recordPronunciationExperiment(sample(), log);
  const second = recordPronunciationExperiment(sample(), log);
  check(second.id === first.id, "replay returns the same record");
  check(log.events.length === 1, "replay does not append");
  check(tide.getLogs().length === 0, "replay does not rate");
  const before = JSON.stringify(tide.snapshot());
  const conflict = throws(() => recordPronunciationExperiment(sample({ score: 10 }), log));
  check(conflict instanceof PronunciationScheduleError, "conflict is the pronunciation error");
  check(log.events.length === 1, "conflict does not append");
  check(log.events[0].payload.score === 72, "stored score stays");
  check(JSON.stringify(tide.snapshot()) === before, "conflict does not move due");
});

section("illegal scores and smuggled schedule fields write nothing", () => {
  const cases = [
    ["missing", {}],
    ["nan", sample({ score: Number.NaN })],
    ["infinity", sample({ score: Number.POSITIVE_INFINITY })],
    ["negative", sample({ score: -0.1 })],
    ["over", sample({ score: 100.1 })],
    ["text score", sample({ score: "72" })],
    ["version 2", sample({ schema_version: 2 })],
    ["version text", sample({ schema_version: "1" })],
    ["asr source", sample({ source: "asr" })],
    ["live source", sample({ source: "live" })],
    ["not fixture", sample({ fixture: false })],
    ["wrong label", sample({ fixture_label: "learner-voice" })],
    ["missing text", sample({ reference_text: "" })],
    ["due", sample({ due: "2099-01-01T00:00:00.000Z" })],
    ["grade", sample({ grade: 4 })],
    ["reps", sample({ reps: 3 })],
    ["audio", sample({ audio: [1, 2, 3] })],
    ["unknown", sample({ provider: "secret-vendor" })],
    ["blank id", sample({ client_event_id: "  " })],
    ["array", []],
    ["null", null],
  ];
  for (const [name, input] of cases) {
    const { log, tide } = harness();
    const beforeTide = JSON.stringify(tide.snapshot());
    const beforeLog = JSON.stringify(log.snapshot());
    const error = throws(() => recordPronunciationExperiment(input, log));
    check(error instanceof PronunciationScheduleError, `${name} is refused`);
    check(JSON.stringify(tide.snapshot()) === beforeTide, `${name} does not change the schedule`);
    check(JSON.stringify(log.snapshot()) === beforeLog, `${name} does not write an event`);
    check(tide.getLogs().length === 0, `${name} does not add a review`);
  }
});

section("the score cannot become a grade or ride along into rate", () => {
  const converted = throws(() => pronunciationScoreToGrade(sample()));
  check(converted instanceof PronunciationScheduleError, "conversion throws");
  check(throws(() => pronunciationScoreToGrade(100)) instanceof PronunciationScheduleError, "bare number throws");
  check(throws(() => pronunciationScoreToGrade({ grade: 4, score: 100 })) instanceof PronunciationScheduleError, "grade field throws");

  const { t0, tide, log, steward, meaning } = harness();
  const before = JSON.stringify(tide.snapshot());
  const beforeLog = JSON.stringify(log.snapshot());
  const beforeUnlock = {
    meaning: deriveAspectUnlockState("en_tide", "meaning", tide.getLogs()),
    phonology: deriveAspectUnlockState("en_tide", "phonology_text", tide.getLogs()),
  };
  const scored = throws(() =>
    steward.rate(meaning.id, 4, t0, { client_event_id: "inject", score: 100, pronunciation: sample() }),
  );
  check(scored instanceof PronunciationScheduleError, "steward refuses a score extra");
  check(JSON.stringify(tide.snapshot()) === before, "refused score does not change due or reps");
  check(JSON.stringify(log.snapshot()) === beforeLog, "refused score writes no retrieval event");
  check(tide.getCard(meaning.id).review.reps === 0, "reps stay 0");
  check(
    deriveAspectUnlockState("en_tide", "meaning", tide.getLogs()) === beforeUnlock.meaning,
    "meaning unlock unchanged",
  );
  check(
    deriveAspectUnlockState("en_tide", "phonology_text", tide.getLogs()) === beforeUnlock.phonology,
    "phonology unlock unchanged",
  );

  const nested = throws(() => steward.rate(meaning.id, 4, t0, { meta: { score: 80 } }));
  check(nested instanceof PronunciationScheduleError, "nested metadata cannot enter rate");
  check(tide.getCard(meaning.id).review.reps === 0, "nested metadata does not rate");

  const smuggledGrade = throws(() => steward.rate(meaning.id, 3, t0, { grade: 4 }));
  check(smuggledGrade instanceof PronunciationScheduleError, "extra grade is not a second channel");
  check(tide.getLogs().length === 0, "extra grade does not rate");

  const due = throws(() =>
    steward.rate(meaning.id, 3, t0, { due: "2099-01-01T00:00:00.000Z", score: 100 }),
  );
  check(due instanceof SchedulePolicyError, "due is still the schedule-policy error");
  check(tide.getLogs().length === 0, "due plus score does not rate");
});

section("meaning, spelling, and typed IPA still rate; phonology stays off the chain", () => {
  check(WORD_TIDE_CONFIG.phonologyInUnlockChain === false, "phonology switch stays off");
  const { t0, tide, log, steward, meaning, phonology } = harness();
  const form = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "form", t0);
  const ipaGrade = assistGrade("phonology_text", "/taɪd/", "taɪd");
  check(ipaGrade === 3, "typed IPA still has a text grade");
  const meaningResult = steward.rate(meaning.id, 3, t0, { client_event_id: "meaning-1" });
  const formResult = steward.rate(form.id, 4, t0, { client_event_id: "form-1" });
  const ipaResult = steward.rate(phonology.id, ipaGrade, t0, { client_event_id: "ipa-1" });
  check(meaningResult.card.review.reps === 1, "meaning retrieval still rates");
  check(formResult.card.review.reps === 1, "spelling retrieval still rates");
  check(ipaResult.card.review.reps === 1, "typed IPA still rates");
  check(ipaResult.card.aspect === "phonology_text", "IPA card stays the text track");
  check(log.events.filter((event) => event.event_type === "retrieval_grade").length === 3, "three retrievals");
  check(
    deriveAspectUnlockState("en_tide", "phonology_text", tide.getLogs()) === "locked",
    "a text IPA grade does not unlock phonology",
  );
  const dueAfter = ipaResult.card.review.due.toISOString();
  const repsAfter = ipaResult.card.review.reps;
  recordPronunciationExperiment(sample({ client_event_id: "after-ipa" }), log);
  check(tide.getCard(phonology.id).review.due.toISOString() === dueAfter, "experiment leaves the IPA due");
  check(tide.getCard(phonology.id).review.reps === repsAfter, "experiment leaves the IPA reps");
  check(
    log.events.filter((event) => event.event_type === "retrieval_grade").length === 3,
    "experiment does not add a retrieval",
  );
  const replay = steward.rate(phonology.id, ipaGrade, t0, { client_event_id: "ipa-1" });
  check(replay.replayed === true, "the text IPA replay still replays");
  check(tide.getCard(phonology.id).review.reps === 1, "replay does not double the IPA reps");
});

section("no audio implementation is wired to the learner page", () => {
  const source = readFileSync(new URL("../packages/core/src/providers/pronunciation-boundary.ts", import.meta.url), "utf8");
  check(!source.includes(".rate("), "boundary does not call rate");
  check(!source.includes("TideScheduler"), "boundary does not own a scheduler");
  check(!source.includes("fetch("), "boundary has no network");
  check(!source.includes("getUserMedia"), "boundary has no microphone");
  check(!source.includes("process.env"), "boundary has no secrets");
  const placeholder = readFileSync(new URL("../packages/core/src/providers/voice-placeholder.ts", import.meta.url), "utf8");
  check(placeholder.includes("本阶段不实现"), "placeholder still says voice is not implemented");
  check(!placeholder.includes("getUserMedia"), "placeholder has no microphone");
  const page = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(!page.includes("recordPronunciationExperiment"), "review page does not record speech scores");
  check(!page.includes("pronunciationScoreToGrade"), "review page does not convert speech scores");
  check(!page.includes("getUserMedia"), "review page has no microphone");
});

if (failures.length > 0) {
  console.error(`assert-e8a-pronunciation-boundary: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e8a-pronunciation-boundary: ok");
