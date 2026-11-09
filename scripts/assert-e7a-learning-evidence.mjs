/**
 * E7a: delayed self-rated retrieval is not a click count.
 * payload.due is the due written after rate. It is not due_before.
 * Run: node --import tsx scripts/assert-e7a-learning-evidence.mjs
 */
import { readFileSync } from "node:fs";
import {
  LOCAL_LEARNER_ID,
  AgentEventLog,
  TideScheduler,
  TideSteward,
  dayIdShanghai,
  LEARNING_EVIDENCE_VERSION,
  summarizeLearningEvidence,
  formatLearningEvidence,
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

const DAY1 = "2026-10-25T15:59:59.000Z";
const DAY2 = "2026-10-25T16:00:00.000Z";
const CARD = "local-learner:en_tide:meaning";

function retrieval(overrides = {}) {
  const reviewedAt = overrides.reviewed_at ?? "2026-10-26T04:00:00.000Z";
  const reps = overrides.reps_before ?? 1;
  const payload = {
    grade: overrides.grade ?? 3,
    evidence_version: overrides.evidence_version === undefined ? 1 : overrides.evidence_version,
    due_before: overrides.due_before ?? reviewedAt,
    reps_before: reps,
    state_before: overrides.state_before ?? (reps === 0 ? 0 : 2),
    reviewed_at: reviewedAt,
    last_review_before:
      overrides.last_review_before === undefined
        ? reps === 0
          ? null
          : "2026-10-20T04:00:00.000Z"
        : overrides.last_review_before,
  };
  if (overrides.client_event_id !== undefined) payload.client_event_id = overrides.client_event_id;
  if (overrides.post_due !== undefined) payload.due = overrides.post_due;
  if (overrides.extra) Object.assign(payload, overrides.extra);
  for (const key of overrides.omit ?? []) delete payload[key];
  return {
    id: overrides.id ?? "evt-1",
    event_type: overrides.event_type ?? "retrieval_grade",
    card_id: overrides.card_id === undefined ? CARD : overrides.card_id,
    created_at: overrides.created_at ?? reviewedAt,
    payload,
  };
}

function legacy(overrides = {}) {
  return {
    id: overrides.id ?? "legacy-1",
    event_type: "retrieval_grade",
    card_id: overrides.card_id ?? CARD,
    created_at: overrides.created_at ?? "2026-10-26T04:00:00.000Z",
    payload: {
      grade: overrides.grade ?? 3,
      due: overrides.due ?? "2020-01-01T00:00:00.000Z",
      scheduled_days: 5,
      source: "TideScheduler.rate",
      client_event_id: overrides.client_event_id ?? overrides.id ?? "legacy-1",
    },
  };
}

section("shanghai day boundary", () => {
  check(dayIdShanghai(new Date(DAY1)) === "2026-10-25", "15:59:59Z is still 10-25 in Shanghai");
  check(dayIdShanghai(new Date(DAY2)) === "2026-10-26", "16:00:00Z is 10-26 in Shanghai");
  check(LEARNING_EVIDENCE_VERSION === 1, "evidence version is 1");
});

section("empty log is no data, not a rate", () => {
  const report = summarizeLearningEvidence({ events: [] });
  check(report.status === "empty", "empty status");
  check(report.timezone === "Asia/Shanghai", "timezone");
  check(report.delayed_retrieval.status === "no_data", "empty delayed status");
  check(report.delayed_retrieval.numerator === null, "empty numerator");
  check(report.delayed_retrieval.denominator === null, "empty denominator");
  check(report.delayed_retrieval.ratio === null, "empty ratio");
  check(report.delayed_retrieval.again_ratio === null, "empty again ratio");
  check(report.cross_night.ratio === null, "empty cross-night ratio");
  check(report.compliance.status === "no_data", "empty compliance");
  check(report.compliance.days === null, "empty compliance days");
  check(report.activity.retrieval_submissions === 0, "empty click count is a count");
  check(report.activity.note === "clicks_and_xp_are_not_retention", "xp is not the metric");
  check(report.xp === undefined, "report has no xp");
  const lines = formatLearningEvidence(report).join("\n");
  check(lines.includes("暂时没有"), "empty copy says there is no data");
  check(!lines.includes("学会率"), "empty copy has no learned-rate label");
  check(!lines.includes("0%"), "empty copy is not 0%");
  check(!lines.includes("100%"), "empty copy is not 100%");
});

section("invalid input stays null and does not throw", () => {
  for (const input of [undefined, null, {}, { events: null }, { events: {} }]) {
    const report = summarizeLearningEvidence(input);
    check(report.status === "invalid", `invalid status for ${JSON.stringify(input)}`);
    check(report.delayed_retrieval.ratio === null, "invalid ratio");
    check(report.delayed_retrieval.denominator === null, "invalid denominator");
    check(report.activity.retrieval_submissions === null, "invalid clicks");
    check(report.compliance.days === null, "invalid compliance");
  }
});

section("due review counts self-rated good or easy only", () => {
  const good = summarizeLearningEvidence({
    events: [retrieval({ id: "g", client_event_id: "g", grade: 3, post_due: "2099-01-01T00:00:00.000Z" })],
  });
  check(good.delayed_retrieval.numerator === 1, "good is the numerator");
  check(good.delayed_retrieval.denominator === 1, "good is in the denominator");
  check(good.delayed_retrieval.ratio === 1, "one due good");
  check(good.delayed_retrieval.grade_counts["3"] === 1, "grade tally");
  check(good.activity.retrieval_submissions === 1, "one submission");
  check(good.definition.includes("payload.due"), "definition names the post-rate due");
  const lines = formatLearningEvidence(good).join("\n");
  check(lines.includes("1/1"), "shows the fraction");
  check(lines.includes("自评"), "labels self-rating");
  check(lines.includes("样本少"), "labels the small sample");
  check(!lines.includes("学会率"), "no learned-rate label");
  check(!/\d+%/.test(lines), "no percent");

  const easy = summarizeLearningEvidence({
    events: [retrieval({ id: "e", client_event_id: "e", grade: 4 })],
  });
  check(easy.delayed_retrieval.numerator === 1, "easy counts as the self-rated proxy");

  const hard = summarizeLearningEvidence({
    events: [retrieval({ id: "h", client_event_id: "h", grade: 2 })],
  });
  check(hard.delayed_retrieval.numerator === 0, "hard is not the proxy");
  check(hard.delayed_retrieval.denominator === 1, "hard still happened");
  check(hard.delayed_retrieval.ratio === 0, "zero successes over a real denominator");

  const again = summarizeLearningEvidence({
    events: [retrieval({ id: "a", client_event_id: "a", grade: 1 })],
  });
  check(again.delayed_retrieval.numerator === 0, "again is not success");
  check(again.delayed_retrieval.again_count === 1, "again is tallied");
  check(again.delayed_retrieval.again_ratio === 1, "again share");
  check(!formatLearningEvidence(again).join("\n").includes("学会率"), "again copy has no learned-rate");
});

section("exact due is included and one millisecond early is not", () => {
  const atDue = summarizeLearningEvidence({
    events: [retrieval({ id: "at", client_event_id: "at", reviewed_at: "2026-10-26T04:00:00.000Z", due_before: "2026-10-26T04:00:00.000Z" })],
  });
  check(atDue.delayed_retrieval.denominator === 1, "reviewed_at equal to due_before is due");
  check(atDue.early_count === 0, "equal is not early");

  const early = summarizeLearningEvidence({
    events: [
      retrieval({
        id: "early",
        client_event_id: "early",
        reviewed_at: "2026-10-26T03:59:59.999Z",
        due_before: "2026-10-26T04:00:00.000Z",
        grade: 3,
      }),
    ],
  });
  check(early.delayed_retrieval.ratio === null, "early practice is not a delayed-retrieval rate");
  check(early.delayed_retrieval.denominator === null, "early practice is outside the denominator");
  check(early.early_count === 1, "early practice is counted aside");
  check(early.activity.retrieval_submissions === 1, "early practice is still a click");
});

section("a new card is first learning even when its due is now", () => {
  const report = summarizeLearningEvidence({
    events: [
      retrieval({
        id: "new",
        client_event_id: "new",
        reps_before: 0,
        state_before: 0,
        last_review_before: null,
        grade: 4,
        post_due: "2099-01-01T00:00:00.000Z",
      }),
    ],
  });
  check(report.first_learning_count === 1, "new card counted");
  check(report.delayed_retrieval.ratio === null, "new card does not create a delayed rate");
  check(report.delayed_retrieval.numerator === null, "new card is not a success");
});

section("post-rate due is not pre-review due", () => {
  const trap = summarizeLearningEvidence({
    events: [
      legacy({
        id: "trap",
        client_event_id: "trap",
        due: "2020-01-01T00:00:00.000Z",
        created_at: "2026-10-26T04:00:00.000Z",
        grade: 3,
      }),
      legacy({
        id: "future",
        client_event_id: "future",
        due: "2099-01-01T00:00:00.000Z",
        grade: 3,
      }),
    ],
  });
  check(trap.delayed_retrieval.ratio === null, "legacy due echo does not create a rate");
  check(trap.delayed_retrieval.numerator === null, "legacy good is not delayed success");
  check(trap.coverage.missing_pre_review_evidence === 2, "legacy rows are uncovered");
  check(trap.activity.retrieval_submissions === 2, "legacy rows can still be clicks");
  const lines = formatLearningEvidence(trap).join("\n");
  check(lines.includes("暂时没有"), "no delayed conclusion");
  check(lines.includes("2"), "coverage is visible");
  check(lines.includes("没有练习前的到期时间"), "coverage says why");
  check(!lines.includes("学会率"), "coverage copy has no learned-rate");
});

section("homepage, again-only nights, and quests do not become remembering", () => {
  const home = summarizeLearningEvidence({
    events: [{ id: "s", event_type: "session_start", payload: {}, created_at: DAY2 }],
  });
  check(home.homepage_only === true, "homepage only");
  check(home.delayed_retrieval.numerator === null, "homepage does not increment remembering");
  check(home.activity.retrieval_submissions === 0, "homepage is not a retrieval click");
  check(home.compliance.days === 0, "opening a page is not a study day");
  check(!formatLearningEvidence(home).join("\n").includes("学会"), "homepage copy draws no learning conclusion");

  const sessionEnd = summarizeLearningEvidence({
    events: [{ id: "end", event_type: "session_end", payload: {}, created_at: DAY2 }],
  });
  check(sessionEnd.compliance.days === 0, "session_end alone is not compliance");
  check(sessionEnd.homepage_only === false, "session_end is not a homepage visit");

  const againNights = summarizeLearningEvidence({
    events: [
      retrieval({ id: "n1", client_event_id: "n1", grade: 1, reviewed_at: DAY1, due_before: DAY1 }),
      retrieval({ id: "n2", client_event_id: "n2", grade: 1, reviewed_at: DAY2, due_before: DAY2 }),
    ],
  });
  check(againNights.cross_night.status === "counted", "two dated due reviews can be compared");
  check(againNights.cross_night.cards === 1, "one card");
  check(againNights.cross_night.still_self_rated_at_least_good === 0, "again does not add cross-night success");
  check(againNights.cross_night.ratio === 0, "cross-night proxy is zero over a real card");
  check(againNights.delayed_retrieval.numerator === 0, "again does not add delayed success");
  check(againNights.delayed_retrieval.denominator === 2, "both due agains are the sample");

  const quests = summarizeLearningEvidence({
    events: [
      { id: "q", event_type: "quest_success", payload: { xp: 50 }, created_at: DAY2 },
      { id: "hit", event_type: "must_elicit_hit", payload: {}, created_at: DAY2 },
      { id: "miss", event_type: "must_elicit_miss", payload: {}, created_at: DAY2 },
    ],
  });
  check(quests.delayed_retrieval.ratio === null, "quest success is not FSRS remembering");
  check(quests.quest.success_count === 1, "quest is counted aside");
  check(quests.quest.must_elicit_hit_count === 1, "must_elicit hit is aside");
  check(quests.quest.must_elicit_miss_count === 1, "must_elicit miss is aside");
  check(quests.quest.counted_in_delayed_retrieval === false, "quest flag stays off");
  check(quests.compliance.days === 0, "a quest is not a recall day");
});

section("cross-night uses reviewed_at in Shanghai, not created_at", () => {
  const kept = summarizeLearningEvidence({
    events: [
      retrieval({
        id: "d1",
        client_event_id: "d1",
        grade: 3,
        reviewed_at: DAY1,
        due_before: DAY1,
        reps_before: 0,
        state_before: 0,
        last_review_before: null,
        created_at: DAY1,
      }),
      retrieval({
        id: "d2",
        client_event_id: "d2",
        grade: 3,
        reviewed_at: DAY2,
        due_before: DAY2,
        created_at: DAY1,
      }),
    ],
  });
  check(kept.cross_night.cards === 1, "next Shanghai day counts");
  check(kept.cross_night.still_self_rated_at_least_good === 1, "later good counts");
  check(kept.cross_night.ratio === 1, "one card stayed self-rated good");
  check(kept.delayed_retrieval.denominator === 1, "the first-learning day is not in the due denominator");

  const sameDay = summarizeLearningEvidence({
    events: [
      retrieval({ id: "s1", client_event_id: "s1", reviewed_at: DAY2, due_before: DAY2, created_at: DAY1 }),
      retrieval({ id: "s2", client_event_id: "s2", reviewed_at: DAY2, due_before: DAY2, created_at: "2026-10-26T16:00:00.000Z", card_id: CARD }),
    ],
  });
  check(sameDay.cross_night.status === "no_pair", "created_at on another day does not invent a night");
  check(sameDay.cross_night.ratio === null, "no pair is not 0%");
  check(formatLearningEvidence(sameDay).join("\n").includes("还没有跨到下一个上海日"), "copy says the night is missing");

  const earlyNext = summarizeLearningEvidence({
    events: [
      retrieval({ id: "p1", client_event_id: "p1", reviewed_at: DAY1, due_before: DAY1, grade: 3 }),
      retrieval({
        id: "p2",
        client_event_id: "p2",
        reviewed_at: DAY2,
        due_before: "2026-11-01T00:00:00.000Z",
        grade: 3,
      }),
    ],
  });
  check(earlyNext.cross_night.ratio === null, "an early next-day practice is not cross-night success");
  check(earlyNext.early_count === 1, "the early row is visible");
});

section("replay, conflict, order, and input stability", () => {
  const first = retrieval({ id: "e1", client_event_id: "same", grade: 3, extra: { xp: 999 } });
  const replay = retrieval({ id: "e2", client_event_id: "same", grade: 3, extra: { xp: 999 } });
  const once = summarizeLearningEvidence({ events: [first, replay] });
  check(once.delayed_retrieval.denominator === 1, "same client_event_id replay counts once");
  check(once.activity.retrieval_submissions === 1, "replay is one click");

  const conflict = summarizeLearningEvidence({
    events: [
      retrieval({ id: "c1", client_event_id: "clash", grade: 3 }),
      retrieval({ id: "c2", client_event_id: "clash", grade: 1 }),
    ],
  });
  check(conflict.delayed_retrieval.ratio === null, "conflict is not resolved by picking a grade");
  check(conflict.coverage.conflict_groups === 1, "one conflict group");
  check(conflict.conflicts.length === 1, "conflict is listed");
  check(conflict.conflicts[0].client_event_id === "clash", "conflict key");
  check(
    JSON.stringify(conflict.conflicts[0].event_ids) === JSON.stringify(["c1", "c2"]),
    "both ids stay visible",
  );
  check(formatLearningEvidence(conflict).join("\n").includes("内容对不上"), "conflict is explained");

  const box = [
    retrieval({ id: "b", client_event_id: "b", grade: 1 }),
    retrieval({ id: "a", client_event_id: "a", grade: 3, card_id: "local-learner:en_wave:meaning" }),
  ];
  const forward = JSON.stringify(summarizeLearningEvidence({ events: box }));
  const backward = JSON.stringify(summarizeLearningEvidence({ events: [...box].reverse() }));
  check(forward === backward, "order does not change the report");
  const again = JSON.stringify(summarizeLearningEvidence({ events: box }));
  check(again === forward, "same input is stable");

  const frozen = JSON.stringify(box);
  const dueEcho = box[0].payload.due;
  summarizeLearningEvidence({ events: box });
  check(JSON.stringify(box) === frozen, "input events stay unchanged");
  check(box[0].payload.due === dueEcho, "payload due echo stays unchanged");
  check(box.map((row) => row.id).join() === "b,a", "input order stays unchanged");
});

section("old, broken, and partial rows are excluded", () => {
  const rows = [
    retrieval({ id: "bad-grade", client_event_id: "bad-grade", grade: 9 }),
    retrieval({ id: "string-grade", client_event_id: "string-grade", grade: "3" }),
    retrieval({ id: "no-date", client_event_id: "no-date", due_before: "yesterday" }),
    retrieval({ id: "blank-date", client_event_id: "blank-date", reviewed_at: "  " }),
    retrieval({ id: "half-rep", client_event_id: "half-rep", reps_before: 1.5 }),
    retrieval({ id: "neg-rep", client_event_id: "neg-rep", reps_before: -1 }),
    retrieval({ id: "mismatch", client_event_id: "mismatch", reps_before: 0, state_before: 2, last_review_before: null }),
    retrieval({
      id: "future-last",
      client_event_id: "future-last",
      last_review_before: "2026-10-27T00:00:00.000Z",
      reviewed_at: "2026-10-26T04:00:00.000Z",
    }),
    retrieval({ id: "version-2", client_event_id: "version-2", evidence_version: 2 }),
    retrieval({ id: "version-text", client_event_id: "version-text", evidence_version: "1" }),
    retrieval({ id: "no-card", client_event_id: "no-card", card_id: null }),
    { id: "junk", event_type: "retrieval_grade", payload: null, created_at: DAY2 },
    null,
  ];
  const report = summarizeLearningEvidence({ events: rows });
  check(report.delayed_retrieval.ratio === null, "broken rows do not create a rate");
  check(report.coverage.rejected >= 1, "broken rows are rejected");
  check(report.coverage.unsupported_version === 2, "other versions are not coerced");
  check(report.rejected.some((row) => row.event_id === "no-card" && row.reason === "missing_card"), "missing card is visible");
  check(report.rejected.some((row) => row.event_id === "bad-grade"), "bad grade is traceable");
  check(!report.rejected.some((row) => row.reason === undefined), "reasons exist");

  const noId = summarizeLearningEvidence({
    events: [{ event_type: "retrieval_grade", payload: { grade: 3, evidence_version: 1 }, created_at: DAY2 }],
  });
  check(noId.delayed_retrieval.ratio === null, "missing identity is not counted");
  check(noId.coverage.missing_identity === 1, "missing identity is covered");

  const spaced = retrieval({ id: "keep", client_event_id: "   " });
  const fallback = summarizeLearningEvidence({ events: [spaced] });
  check(fallback.delayed_retrieval.denominator === 1, "blank client id falls back to the event id");
});

section("unknown last study time does not block a known due comparison", () => {
  const report = summarizeLearningEvidence({
    events: [retrieval({ id: "nolast", client_event_id: "nolast", last_review_before: null, reps_before: 1 })],
  });
  check(report.delayed_retrieval.denominator === 1, "due_before is enough to classify the review");
  check(report.coverage.missing_last_review === 1, "missing previous study time stays visible");
});

section("window drops later rows and does not date legacy rows", () => {
  const reviewed = "2026-10-26T04:00:00.000Z";
  const inside = summarizeLearningEvidence({
    events: [retrieval({ id: "in", client_event_id: "in", reviewed_at: reviewed, due_before: reviewed })],
    asOf: new Date(reviewed),
    windowStart: new Date(reviewed),
  });
  check(inside.delayed_retrieval.denominator === 1, "inclusive window keeps the instant");

  const outside = summarizeLearningEvidence({
    events: [retrieval({ id: "out", client_event_id: "out", reviewed_at: reviewed, due_before: reviewed })],
    asOf: new Date("2026-10-26T03:59:59.999Z"),
  });
  check(outside.delayed_retrieval.ratio === null, "after the window is not a failure");
  check(outside.coverage.outside_window === 1, "outside row is counted aside");

  const undated = summarizeLearningEvidence({
    events: [legacy({ id: "old", client_event_id: "old" })],
    asOf: new Date(reviewed),
  });
  check(undated.activity.retrieval_submissions === 0, "legacy row is not placed in a window by created_at");
  check(undated.coverage.missing_pre_review_evidence === 1, "legacy row stays uncovered");
  check(summarizeLearningEvidence({ events: [legacy({ id: "old" })] }).activity.retrieval_submissions === 1, "without a window the click remains");

  const badClock = summarizeLearningEvidence({ events: [], asOf: new Date("not-a-date") });
  check(badClock.status === "invalid", "bad window is invalid");
});

section("meaning use stays separate from remembering", () => {
  const omitted = summarizeLearningEvidence({ events: [] });
  check(omitted.meaning_use.status === "not_provided", "omitted records are not a zero rate");
  check(omitted.meaning_use.form_present_ratio === null, "omitted ratio");
  check(!formatLearningEvidence(omitted).join("\n").includes("目标词"), "no sentence conclusion without records");

  const empty = summarizeLearningEvidence({ events: [], meaningUseRecords: [] });
  check(empty.meaning_use.status === "empty", "empty records were looked at");
  check(empty.meaning_use.form_present_ratio === null, "no sentences is not 0%");
  check(empty.compliance.days === null, "empty use log is still no compliance data");

  const mixed = [
    {
      id: "pass",
      verdict: "basic_pass",
      semantic_status: "not_evaluated",
      meaning_judged: false,
      checked_at: DAY2,
      event_type: "meaning_use",
    },
    {
      id: "pass-replay",
      verdict: "basic_pass",
      semantic_status: "not_evaluated",
      meaning_judged: false,
      checked_at: DAY2,
    },
    {
      id: "fail",
      verdict: "basic_fail",
      semantic_status: "not_evaluated",
      meaning_judged: false,
      checked_at: DAY1,
    },
    {
      id: "skip",
      verdict: "skipped",
      semantic_status: "not_evaluated",
      meaning_judged: false,
      checked_at: DAY1,
    },
    {
      id: "fixture",
      verdict: "basic_pass",
      semantic_status: "not_evaluated",
      fixture: true,
      checked_at: "2026-10-27T16:00:00.000Z",
    },
    {
      id: "claimed",
      verdict: "basic_pass",
      semantic_status: "correct",
      meaning_judged: true,
      checked_at: DAY2,
    },
  ];
  const before = JSON.stringify(mixed);
  const report = summarizeLearningEvidence({ events: [retrieval({ id: "r", client_event_id: "r" })], meaningUseRecords: mixed });
  check(JSON.stringify(mixed) === before, "meaning-use input stays unchanged");
  check(report.meaning_use.form_present_count === 2, "basic pass counts twice when ids differ");
  check(report.meaning_use.form_absent_count === 1, "basic fail is separate");
  check(report.meaning_use.skipped_count === 1, "skip is separate");
  check(report.meaning_use.fixture_excluded_count === 1, "fixture is not a learner sentence");
  check(report.meaning_use.not_accepted_count === 1, "a claimed judgment is not accepted");
  check(report.meaning_use.semantic_judged_count === 0, "nothing here was semantically judged");
  check(report.meaning_use.form_present_ratio === 2 / 3, "ratio is pass over pass plus fail");
  check(report.delayed_retrieval.denominator === 1, "sentences do not enter the due denominator");
  check(report.compliance.days === 2, "recall and sentences share Shanghai days, fixture does not");
  const lines = formatLearningEvidence(report).join("\n");
  check(lines.includes("有 2 句里出现了目标词"), "form presence is stated as a count");
  check(lines.includes("还没判断"), "semantic status stays open");
  check(lines.includes("跳过不算"), "skip is not mastery");
  check(!lines.includes("学会率"), "sentence copy has no learned-rate");
  check(!/\d+%/.test(lines), "sentence copy has no percent");

  const skipOnly = summarizeLearningEvidence({
    events: [],
    meaningUseRecords: [{ id: "s", verdict: "skipped", semantic_status: "not_evaluated", checked_at: DAY2 }],
  });
  check(skipOnly.meaning_use.form_present_ratio === null, "skips are not a denominator of mastery");
  check(skipOnly.compliance.days === 1, "a finished skip is still a study day");
  check(formatLearningEvidence(skipOnly).join("\n").includes("跳过不算"), "skip-only copy");

  const clash = summarizeLearningEvidence({
    events: [],
    meaningUseRecords: [
      { id: "m", verdict: "basic_pass", semantic_status: "not_evaluated", checked_at: DAY2 },
      { id: "m", verdict: "basic_fail", semantic_status: "not_evaluated", checked_at: DAY2 },
    ],
  });
  check(clash.meaning_use.form_present_count === 0, "conflicting sentence ids are not picked");
  check(clash.meaning_use.conflicts.length === 1, "sentence conflict is listed");

  const badRecords = summarizeLearningEvidence({ events: [], meaningUseRecords: { id: "nope" } });
  check(badRecords.meaning_use.status === "invalid", "non-array records are invalid");
  check(badRecords.meaning_use.form_present_ratio === null, "invalid records have no ratio");
});

section("steward records pre-review evidence without moving due", () => {
  const t0 = new Date("2026-10-20T04:00:00.000Z");
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const plain = new TideScheduler({ requestRetention: 0.9 });
  const log = new AgentEventLog();
  const steward = new TideSteward(tide, log);
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  const plainCard = plain.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  const dueBefore = tide.getCard(card.id).review.due.toISOString();
  const repsBefore = tide.getCard(card.id).review.reps;
  const result = steward.rate(card.id, 3, t0, { client_event_id: "first" });
  const plainResult = plain.rate(plainCard.id, 3, t0);
  check(result.card.review.due.toISOString() === plainResult.card.review.due.toISOString(), "added evidence does not change due");
  check(result.card.review.reps === plainResult.card.review.reps, "added evidence does not change reps");
  check(result.log.grade === 3, "grade is unchanged");
  const payload = log.events[0].payload;
  check(payload.evidence_version === 1, "new events are version 1");
  check(payload.due_before === dueBefore, "due_before is the due from before rate");
  check(payload.reps_before === repsBefore, "reps_before is from before rate");
  check(payload.reps_before === 0, "first rate is a new card");
  check(payload.state_before === 0, "new card state is stored");
  check(payload.reviewed_at === t0.toISOString(), "reviewed_at is the injected clock");
  check(payload.last_review_before === null, "a new card has no previous study");
  check(payload.due === result.card.review.due.toISOString(), "payload.due remains the after-rate echo");
  check(payload.due_before !== payload.due, "the echo is not the pre-review due");
  const firstReport = summarizeLearningEvidence({ events: log.events });
  check(firstReport.first_learning_count === 1, "steward new-card event is first learning");
  check(firstReport.delayed_retrieval.ratio === null, "steward new-card event is not delayed success");

  const dueAfterFirst = tide.getCard(card.id).review.due;
  const earlyAt = new Date(dueAfterFirst.getTime() - 1);
  steward.rate(card.id, 3, earlyAt, { client_event_id: "early" });
  check(log.events[1].payload.due_before === dueAfterFirst.toISOString(), "second due_before is the due after the first rate");
  check(log.events[1].payload.reps_before >= 1, "second review has prior reps");
  const earlyReport = summarizeLearningEvidence({ events: log.events });
  check(earlyReport.early_count === 1, "one millisecond before due is early");
  check(earlyReport.delayed_retrieval.ratio === null, "early second review has no delayed rate");

  const snap = JSON.stringify(tide.snapshot());
  const logSnap = JSON.stringify(log.snapshot());
  summarizeLearningEvidence({ events: log.events });
  check(JSON.stringify(tide.snapshot()) === snap, "the report does not change the schedule snapshot");
  check(JSON.stringify(log.snapshot()) === logSnap, "the report does not change the event log");
  const repsAfterEarly = tide.getCard(card.id).review.reps;
  steward.rate(card.id, 3, earlyAt, { client_event_id: "early" });
  check(log.events.length === 2, "replay does not append another retrieval event");
  check(tide.getCard(card.id).review.reps === repsAfterEarly, "replay keeps reps");
});

section("a later review exactly at due is the delayed sample", () => {
  const t0 = new Date("2026-10-20T04:00:00.000Z");
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const log = new AgentEventLog();
  const steward = new TideSteward(tide, log);
  const card = tide.enqueueNew(LOCAL_LEARNER_ID, { id: "en_tide" }, "meaning", t0);
  steward.rate(card.id, 3, t0, { client_event_id: "n1" });
  const due = tide.getCard(card.id).review.due;
  const reps = tide.getCard(card.id).review.reps;
  steward.rate(card.id, 1, new Date(due.getTime()), { client_event_id: "n2" });
  const second = log.events[1].payload;
  check(second.due_before === due.toISOString(), "due_before matches the due that was current");
  check(second.reviewed_at === due.toISOString(), "reviewed at the due instant");
  check(second.reps_before === reps, "reps_before matches the card before this rate");
  const report = summarizeLearningEvidence({ events: log.events });
  check(report.delayed_retrieval.denominator === 1, "the on-due review is the sample");
  check(report.delayed_retrieval.numerator === 0, "again at due is not success");
  check(report.delayed_retrieval.ratio === 0, "ratio is zero only because the sample exists");
  check(report.first_learning_count === 1, "the first event stays first learning");
  steward.rate(card.id, 1, new Date(due.getTime()), { client_event_id: "n2" });
  check(log.events.length === 2, "replaying the due review does not double the log");
  const replayed = summarizeLearningEvidence({ events: [...log.events, log.events[1]] });
  check(replayed.delayed_retrieval.denominator === 1, "a copied event with the same client id does not double the sample");
});

section("the report is not wired into the learner page", () => {
  const source = readFileSync(new URL("../packages/core/src/learning-evidence.ts", import.meta.url), "utf8");
  check(!source.includes(".rate("), "metric does not call rate");
  check(!source.includes("recordEvent"), "metric does not append events");
  check(!source.includes("localStorage"), "metric does not touch browser storage");
  check(!source.includes("word-tide-gate"), "metric does not move unlocks");
  check(!source.includes("progressFromEvents"), "metric does not reuse xp");
  const page = readFileSync(new URL("../apps/web/src/components/review-session.tsx", import.meta.url), "utf8");
  check(!page.includes("summarizeLearningEvidence"), "review page does not summarize");
  check(!page.includes("formatLearningEvidence"), "review page does not render the lines");
  const home = readFileSync(new URL("../apps/web/src/app/page.tsx", import.meta.url), "utf8");
  check(!home.includes("summarizeLearningEvidence"), "home page does not summarize");
});

if (failures.length > 0) {
  console.error(`assert-e7a-learning-evidence: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("assert-e7a-learning-evidence: ok");
