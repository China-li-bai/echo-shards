/**
 * Minimal Node assertion: campProgressFromSnapshots + progressFromEvents honesty.
 * Run: node --import tsx scripts/assert-camp-progress-local.mjs
 * (invoked via tsx from apps/web path for TS module resolution)
 */
import {
  campProgressFromSnapshots,
  mergeEventLogSnapshots,
} from "../apps/web/src/lib/camp-progress-local.ts";

const now = new Date("2026-10-25T12:00:00+08:00");

const empty = campProgressFromSnapshots([], now);
if (empty.progress.xp !== 0 || empty.progress.streak_days !== 0 || empty.eventCount !== 0) {
  throw new Error(`empty should be real zero, got ${JSON.stringify(empty.progress)}`);
}
if (!empty.sourceLabel.includes("本机")) {
  throw new Error(`expected local source label, got ${empty.sourceLabel}`);
}

const snapA = {
  runs: [],
  proposals: [],
  events: [
    {
      id: "evt_1",
      event_type: "retrieval_grade",
      payload: { grade: 3 },
      created_at: "2026-10-25T03:00:00.000Z",
    },
    {
      id: "evt_2",
      event_type: "session_end",
      payload: {},
      created_at: "2026-10-25T03:10:00.000Z",
    },
  ],
  eval_scores: [],
};

const snapB = {
  runs: [],
  proposals: [],
  // Duplicate evt_1 (day-plan → review restore) must not double-count XP
  events: [
    {
      id: "evt_1",
      event_type: "retrieval_grade",
      payload: { grade: 3 },
      created_at: "2026-10-25T03:00:00.000Z",
    },
    {
      id: "evt_3",
      event_type: "quest_success",
      payload: {},
      created_at: "2026-10-24T04:00:00.000Z",
    },
  ],
  eval_scores: [],
};

const merged = mergeEventLogSnapshots([snapA, snapB]);
if (merged.events.length !== 3) {
  throw new Error(`expected 3 unique events, got ${merged.events.length}`);
}

const view = campProgressFromSnapshots([snapA, snapB], now);
// grade 3 → 30 XP + quest 50 + session_end 5 = 85
if (view.progress.xp !== 85) {
  throw new Error(`expected xp 85, got ${view.progress.xp}`);
}
if (view.progress.quest_success_count !== 1) {
  throw new Error(`expected 1 quest success, got ${view.progress.quest_success_count}`);
}
if (view.progress.retrieval_count !== 1) {
  throw new Error(`expected 1 retrieval, got ${view.progress.retrieval_count}`);
}
if (view.progress.session_count !== 1) {
  throw new Error(`expected 1 session, got ${view.progress.session_count}`);
}
// activity on 2026-10-25 and 2026-10-24 Shanghai → streak 2
if (view.progress.streak_days !== 2) {
  throw new Error(`expected streak 2, got ${view.progress.streak_days}`);
}
if (view.sourceLabel !== "来自本机学习事件") {
  throw new Error(`bad sourceLabel: ${view.sourceLabel}`);
}
// shards = quest_success_count + floor(retrieval/5) = 1 + 0
if (view.progress.shards !== 1) {
  throw new Error(`expected shards 1, got ${view.progress.shards}`);
}

// Deal-only path: exchange finalizeDeal → quest_success must move camp ledger.
const dealSnap = {
  runs: [],
  proposals: [],
  events: [
    {
      id: "deal_1",
      event_type: "quest_success",
      payload: { quest_id: "echo-bazaar-info-gap-01", turns: 4, reason: "文字成交" },
      created_at: "2026-10-25T04:00:00.000Z",
    },
  ],
  eval_scores: [],
};
const dealView = campProgressFromSnapshots([dealSnap], now);
if (dealView.progress.quest_success_count !== 1) {
  throw new Error(`deal: expected 1 quest success, got ${dealView.progress.quest_success_count}`);
}
if (dealView.progress.xp !== 50) {
  throw new Error(`deal: expected xp 50, got ${dealView.progress.xp}`);
}
if (dealView.progress.shards !== 1) {
  throw new Error(`deal: expected shards 1, got ${dealView.progress.shards}`);
}
if (dealView.progress.streak_days !== 1) {
  throw new Error(`deal: expected streak 1, got ${dealView.progress.streak_days}`);
}

// Idempotent re-merge of the same deal snapshot must not double-count.
const dealTwice = campProgressFromSnapshots([dealSnap, dealSnap], now);
if (dealTwice.progress.xp !== 50 || dealTwice.eventCount !== 1) {
  throw new Error(
    `deal idempotent failed: xp=${dealTwice.progress.xp} events=${dealTwice.eventCount}`,
  );
}

console.log("assert-camp-progress-local: OK", {
  xp: view.progress.xp,
  streak_days: view.progress.streak_days,
  shards: view.progress.shards,
  eventCount: view.eventCount,
  deal_xp: dealView.progress.xp,
  deal_shards: dealView.progress.shards,
});
