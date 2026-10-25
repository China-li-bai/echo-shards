/**
 * Shard wall lighting + seal rules.
 * Run: node --import tsx scripts/assert-shard-wall.mjs
 */
import { cardIdFor, deriveShardWall, LOCAL_LEARNER_ID } from "../packages/core/src/index.ts";
import { shardWallFromSnapshots } from "../apps/web/src/lib/shard-wall-local.ts";

const now = new Date("2026-10-25T12:00:00+08:00");
const uid = LOCAL_LEARNER_ID;

function card(lexemeId, aspect = "form") {
  return cardIdFor(uid, lexemeId, aspect);
}

function evt(id, type, created_at, payload = {}, card_id) {
  return {
    id,
    event_type: type,
    card_id,
    payload,
    created_at,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Cold: no events ---
{
  const wall = deriveShardWall({ events: [], now });
  assert(wall.cold === true, "empty should be cold");
  assert(wall.shards.length === 0, "cold must not invent ghost bricks");
  assert(wall.lit_count === 0 && wall.newly_lit_today_count === 0, "cold counts zero");
  assert(wall.far_shore.visible === false, "no far shore without dues");
}

// --- Same-day double Good ≠ light ---
{
  const events = [
    evt("a", "retrieval_grade", "2026-10-25T01:00:00.000Z", { grade: 3 }, card("en_make")),
    evt("b", "retrieval_grade", "2026-10-25T08:00:00.000Z", { grade: 4 }, card("en_make")),
  ];
  const wall = deriveShardWall({ events, now });
  assert(wall.shards.length === 0, "same-day double Good must not light or show brick");
  assert(wall.cold === true, "still cold without cross-day");
}

// --- Two distinct days Good = light; newly lit today ---
{
  const events = [
    evt("c", "retrieval_grade", "2026-10-24T04:00:00.000Z", { grade: 3 }, card("en_take")),
    evt("d", "retrieval_grade", "2026-10-25T03:00:00.000Z", { grade: 3 }, card("en_take")),
  ];
  const wall = deriveShardWall({ events, now });
  assert(wall.cold === false, "should leave cold");
  assert(wall.lit_count === 1, `expected lit 1 got ${wall.lit_count}`);
  assert(wall.newly_lit_today_count === 1, "crossing day is today → newly lit");
  const shard = wall.shards[0];
  assert(shard.lexeme_id === "en_take", "lexeme id");
  assert(shard.lit === true && shard.newly_lit_today === true, "lit + new today");
  assert(shard.successful_days.length === 2, "two success days");
  assert(shard.has_seal === false, "no seal without quest");
}

// --- Older lit (crossed yesterday) stays quiet today ---
{
  const events = [
    evt("e", "retrieval_grade", "2026-10-22T04:00:00.000Z", { grade: 3 }, card("en_time")),
    evt("f", "retrieval_grade", "2026-10-24T04:00:00.000Z", { grade: 4 }, card("en_time")),
    // extra success today must NOT re-flag newly_lit_today (threshold already crossed)
    evt("g", "retrieval_grade", "2026-10-25T02:00:00.000Z", { grade: 3 }, card("en_time")),
  ];
  const wall = deriveShardWall({ events, now });
  const shard = wall.shards.find((s) => s.lexeme_id === "en_time");
  assert(shard?.lit === true, "older cross-day still lit");
  assert(shard?.newly_lit_today === false, "already lit before today → quiet");
  assert(wall.newly_lit_today_count === 0, "no new-today celebration");
}

// --- Hard / Again never count toward lighting ---
{
  const events = [
    evt("h", "retrieval_grade", "2026-10-23T04:00:00.000Z", { grade: 1 }, card("en_want")),
    evt("i", "retrieval_grade", "2026-10-24T04:00:00.000Z", { grade: 2 }, card("en_want")),
    evt("j", "retrieval_grade", "2026-10-25T04:00:00.000Z", { grade: 3 }, card("en_want")),
  ];
  const wall = deriveShardWall({ events, now });
  assert(wall.shards.length === 0, "Again/Hard days do not create success days");
}

// --- Meaning aspect ignored on form wall ---
{
  const events = [
    evt("k", "retrieval_grade", "2026-10-24T04:00:00.000Z", { grade: 3 }, card("en_know", "meaning")),
    evt("l", "retrieval_grade", "2026-10-25T04:00:00.000Z", { grade: 3 }, card("en_know", "meaning")),
  ];
  const wall = deriveShardWall({ events, now, aspect: "form" });
  assert(wall.shards.length === 0, "meaning successes must not light form wall");
}

// --- Deal seal without lit → faint_with_seal ---
{
  const events = [
    evt("m", "quest_success", "2026-10-25T05:00:00.000Z", {
      quest_id: "echo-bazaar-info-gap-01",
      target_lexemes: ["en_bargain", "en_shard"],
      lexeme_ids: ["en_bargain", "en_shard"],
    }),
  ];
  const wall = deriveShardWall({ events, now });
  assert(wall.shards.length === 2, "two faint seal bricks");
  assert(wall.lit_count === 0, "seals alone do not light");
  assert(wall.shards.every((s) => s.faint_with_seal && s.has_seal && !s.lit), "all faint+seal");
  assert(wall.cold === false, "faint seals leave cold invite");
}

// --- Catalog fallback for older quest_success without lexeme ids ---
{
  const events = [
    evt("n", "quest_success", "2026-10-25T05:00:00.000Z", {
      quest_id: "echo-bazaar-info-gap-01",
    }),
  ];
  const wall = deriveShardWall({
    events,
    now,
    quest_targets_by_id: {
      "echo-bazaar-info-gap-01": ["en_tide", "en_echo"],
    },
  });
  assert(wall.seal_count === 2, "catalog fallback seals");
  assert(
    wall.shards.every((s) => ["en_tide", "en_echo"].includes(s.lexeme_id)),
    "fallback lexeme ids",
  );
}

// --- Gap: quest_success with neither payload ids nor catalog → no seal ---
{
  const events = [
    evt("o", "quest_success", "2026-10-25T05:00:00.000Z", {
      quest_id: "unknown-quest",
      turns: 3,
    }),
  ];
  const wall = deriveShardWall({ events, now });
  assert(wall.shards.length === 0, "undocumented deal cannot invent seals");
  assert(wall.cold === true, "still cold");
}

// --- Dual track: lit + seal on same lexeme ---
{
  const events = [
    evt("p", "retrieval_grade", "2026-10-23T04:00:00.000Z", { grade: 3 }, card("en_ask")),
    evt("q", "retrieval_grade", "2026-10-25T04:00:00.000Z", { grade: 4 }, card("en_ask")),
    evt("r", "quest_success", "2026-10-25T06:00:00.000Z", {
      quest_id: "q1",
      lexeme_ids: ["en_ask"],
    }),
  ];
  const wall = deriveShardWall({ events, now });
  const shard = wall.shards[0];
  assert(shard.lit && shard.has_seal && !shard.faint_with_seal, "lit with seal, not faint");
  assert(shard.deal_count === 1, "deal count 1");
}

// --- Far shore from due hints ---
{
  const wall = deriveShardWall({
    events: [],
    now,
    due_cards: [
      { lexeme_id: "en_feel", aspect: "form", due: "2026-10-26T02:00:00.000Z" },
      { lexeme_id: "en_need", aspect: "form", due: "2026-10-20T02:00:00.000Z" }, // overdue
      { lexeme_id: "en_far", aspect: "meaning", due: "2026-10-26T02:00:00.000Z" },
    ],
  });
  assert(wall.far_shore.visible === true, "far shore visible");
  assert(wall.far_shore.due_soon_count === 2, "form dues only, unique");
  assert(wall.cold === true, "far shore alone stays cold invite (no ghost bricks)");
}

// --- Web helper merge path ---
{
  const snap = {
    runs: [],
    proposals: [],
    events: [
      evt("s", "retrieval_grade", "2026-10-24T04:00:00.000Z", { grade: 3 }, card("en_try")),
      evt("t", "retrieval_grade", "2026-10-25T04:00:00.000Z", { grade: 3 }, card("en_try")),
    ],
    eval_scores: [],
  };
  const view = shardWallFromSnapshots([snap, snap], [], { now });
  assert(view.lit_count === 1, "dedupe across snapshots still lights once");
  assert(view.newly_lit_today_count === 1, "new today from web helper");
}

console.log("assert-shard-wall: OK", {
  today: "2026-10-25",
  rules: ["same-day≠light", "cross-day≥2=light", "new-today", "seal dual-track", "far-shore"],
});
