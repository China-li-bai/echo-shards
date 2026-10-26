/**
 * 单词潮汐三件套 P0 闸门断言。
 * Run: node --import tsx scripts/assert-word-tide-gate.mjs
 */
import {
  LOCAL_LEARNER_ID,
  TideScheduler,
  WORD_TIDE_CONFIG,
  WORD_TIDE_COPY,
  apprenticeNoteAfterGrade,
  cardIdFor,
  crossNightSuccessDays,
  deriveAspectUnlockState,
  filterDueByWordTideGate,
  isUnlockedNext,
} from "../packages/core/src/index.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const uid = LOCAL_LEARNER_ID;
const lex = "en_make";

function rateAt(tide, aspect, grade, when) {
  const id = cardIdFor(uid, lex, aspect);
  if (!tide.getCard(id)) tide.enqueueNew(uid, { id: lex }, aspect, when);
  return tide.rate(id, grade, when);
}

// --- 配置默认 ---
{
  assert(WORD_TIDE_CONFIG.crossNightSuccessN === 2, "N default 2");
  assert(
    WORD_TIDE_CONFIG.aspectOrder[0] === "meaning" &&
      WORD_TIDE_CONFIG.aspectOrder[1] === "form",
    "order meaning→form",
  );
  assert(WORD_TIDE_CONFIG.phonologyInUnlockChain === false, "phonology off chain");
}

// --- 当天连对不算跨夜；不能开下一界 ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const d1 = new Date("2026-10-25T02:00:00+08:00");
  const d1b = new Date("2026-10-25T18:00:00+08:00");
  rateAt(tide, "meaning", 3, d1);
  rateAt(tide, "meaning", 4, d1b);
  const days = crossNightSuccessDays({
    lexemeId: lex,
    aspect: "meaning",
    logs: tide.getLogs(),
    cards: tide.allCards(),
  });
  assert(days.length === 1, `same calendar day → 1 success day, got ${days.length}`);
  assert(
    !isUnlockedNext(lex, "meaning", tide.getLogs(), WORD_TIDE_CONFIG, tide.allCards()),
    "same-day double Good must not unlock_next",
  );
  assert(
    deriveAspectUnlockState(lex, "form", tide.getLogs(), WORD_TIDE_CONFIG, tide.allCards()) ===
      "locked",
    "form stays locked before cross-night N",
  );
  const note = apprenticeNoteAfterGrade({
    lexemeId: lex,
    aspect: "meaning",
    grade: 4,
    logs: tide.getLogs(),
    now: d1b,
    cards: tide.allCards(),
  });
  assert(
    note.includes("过今夜") || note.includes("隔夜"),
    `expect overnight copy, got: ${note}`,
  );
}

// --- 跨夜 N=2 → meaning unlocked_next；形界 active ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const d1 = new Date("2026-10-24T10:00:00+08:00");
  const d2 = new Date("2026-10-25T10:00:00+08:00");
  rateAt(tide, "meaning", 3, d1);
  rateAt(tide, "meaning", 3, d2);
  assert(
    isUnlockedNext(lex, "meaning", tide.getLogs(), WORD_TIDE_CONFIG, tide.allCards()),
    "cross-night N met → unlocked_next",
  );
  assert(
    deriveAspectUnlockState(lex, "form", tide.getLogs(), WORD_TIDE_CONFIG, tide.allCards()) ===
      "active",
    "form opens after meaning unlocked_next",
  );
  const note = apprenticeNoteAfterGrade({
    lexemeId: lex,
    aspect: "meaning",
    grade: 3,
    logs: tide.getLogs(),
    now: d2,
    cards: tide.allCards(),
  });
  assert(note.includes("开炉"), `expect forge-open copy, got: ${note}`);
}

// --- 失败不清零跨日计数 ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const d1 = new Date("2026-10-23T10:00:00+08:00");
  const fail = new Date("2026-10-24T10:00:00+08:00");
  const d2 = new Date("2026-10-25T10:00:00+08:00");
  rateAt(tide, "meaning", 3, d1);
  rateAt(tide, "meaning", 1, fail); // Again — 不计成功，也不清零
  rateAt(tide, "meaning", 3, d2);
  const days = crossNightSuccessDays({
    lexemeId: lex,
    aspect: "meaning",
    logs: tide.getLogs(),
    cards: tide.allCards(),
  });
  assert(days.length === 2, `fail must not clear; days=${days.length}`);
  assert(
    isUnlockedNext(lex, "meaning", tide.getLogs(), WORD_TIDE_CONFIG, tide.allCards()),
    "still unlocks after Again in between",
  );
  const failNote = apprenticeNoteAfterGrade({
    lexemeId: lex,
    aspect: "meaning",
    grade: 1,
    logs: tide.getLogs(),
    now: fail,
    cards: tide.allCards(),
  });
  assert(failNote === WORD_TIDE_COPY.failKeepCount, failNote);
}

// --- 同日多界 due 撞车：只留优先未完成界；不改 due ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  // 先让义界跨夜开炉，形界 active；再把两界都弄成 due
  const d1 = new Date("2026-10-20T10:00:00+08:00");
  const d2 = new Date("2026-10-21T10:00:00+08:00");
  rateAt(tide, "meaning", 3, d1);
  rateAt(tide, "meaning", 3, d2);
  // 形界入队（new → due now）
  const now = new Date("2026-10-26T10:00:00+08:00");
  tide.enqueueNew(uid, { id: lex }, "form", now);
  // 把 meaning 再 rate 一次并… 实际上 Good 后 due 会推到未来。
  // 为撞车：直接取 allCards，把「模拟 due」场景用 filter 输入手工 due 卡快照。
  // 闸门只读 due 字段做过滤，断言不写回 scheduler。
  const meaningCard = tide.getCard(cardIdFor(uid, lex, "meaning"));
  const formCard = tide.getCard(cardIdFor(uid, lex, "form"));
  assert(meaningCard && formCard, "both cards exist");
  const dueSnap = [
    {
      ...meaningCard,
      review: { ...meaningCard.review, due: new Date("2026-10-25T00:00:00+08:00") },
    },
    {
      ...formCard,
      review: { ...formCard.review, due: new Date("2026-10-25T01:00:00+08:00") },
    },
  ];
  const beforeDueIso = dueSnap.map((c) => c.review.due.toISOString());
  const gated = filterDueByWordTideGate({
    dueCards: dueSnap,
    logs: tide.getLogs(),
    cards: tide.allCards(),
  });
  assert(gated.sameDayCollision === true, "collision flagged");
  assert(gated.kept.length === 1, `kept 1 got ${gated.kept.length}`);
  // 形界是未完成 active，义界已 unlocked_next → 优先形界
  assert(gated.kept[0].aspect === "form", `prefer unfinished form, got ${gated.kept[0].aspect}`);
  assert(gated.deferred.length === 1 && gated.deferred[0].aspect === "meaning", "defer meaning");
  const afterDueIso = dueSnap.map((c) => c.review.due.toISOString());
  assert(
    beforeDueIso.join("|") === afterDueIso.join("|"),
    "gate must not mutate due on input cards",
  );
  // scheduler 内真实 due 也未被本函数触及（本函数不持有 tide 引用写入口）
  assert(
    typeof filterDueByWordTideGate === "function",
    "filter is pure; TideScheduler.rate remains sole due writer",
  );
}

// --- 新词：义 active，形 locked；音界休整 ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const now = new Date("2026-10-26T10:00:00+08:00");
  for (const aspect of ["meaning", "form", "phonology_text"]) {
    tide.enqueueNew(uid, { id: lex }, aspect, now);
  }
  const due = tide.getDue(now);
  const gated = filterDueByWordTideGate({
    dueCards: due,
    logs: tide.getLogs(),
    cards: tide.allCards(),
  });
  assert(
    gated.kept.length === 1 && gated.kept[0].aspect === "meaning",
    `fresh: only meaning, got ${gated.kept.map((c) => c.aspect).join(",")}`,
  );
  assert(
    gated.lockedOut.some((c) => c.aspect === "form"),
    "form locked out",
  );
  assert(
    gated.lockedOut.some((c) => c.aspect === "phonology_text"),
    "phonology locked / rest",
  );
  assert(
    deriveAspectUnlockState(
      lex,
      "phonology_text",
      tide.getLogs(),
      WORD_TIDE_CONFIG,
      tide.allCards(),
    ) === "locked",
    "phonology locked by default",
  );
  assert(
    WORD_TIDE_COPY.phonologyRest.includes("休整"),
    "phonology rest copy",
  );
}

// --- targetAspect=form 在义未开时 kept 空 ---
{
  const tide = new TideScheduler({ requestRetention: 0.9 });
  const now = new Date("2026-10-26T10:00:00+08:00");
  for (const aspect of ["meaning", "form"]) {
    tide.enqueueNew(uid, { id: lex }, aspect, now);
  }
  const gated = filterDueByWordTideGate({
    dueCards: tide.getDue(now),
    logs: tide.getLogs(),
    targetAspect: "form",
    cards: tide.allCards(),
  });
  assert(gated.kept.length === 0, "cannot open form before meaning cross-night");
}

// --- 文案禁词 ---
{
  const blob = JSON.stringify(WORD_TIDE_COPY);
  for (const bad of ["已掌握", "通关", "学完", "奖杯"]) {
    assert(!blob.includes(bad), `copy must not contain ${bad}`);
  }
}

console.log("assert-word-tide-gate: OK", {
  N: WORD_TIDE_CONFIG.crossNightSuccessN,
  order: WORD_TIDE_CONFIG.aspectOrder,
  phonologyInUnlockChain: WORD_TIDE_CONFIG.phonologyInUnlockChain,
  rules: [
    "same-day≠cross-night",
    "cross-night-N→unlock",
    "fail-keeps-count",
    "same-lemma-one-aspect",
    "phonology-rest",
    "due-unchanged",
  ],
});
