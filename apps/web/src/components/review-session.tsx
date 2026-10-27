"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AgentEventLog,
  ASPECT_LABEL,
  CurriculumDirector,
  EvalSentinel,
  WORD_TIDE_COPY,
  apprenticeLockNote,
  apprenticeNoteAfterGrade,
  composeBatchWhyDebug,
  composeLearnerBatchWhy,
  defaultIncludePhonology,
  deriveAspectUnlockState,
  formatDueShanghai,
  GRADE_LABEL,
  LOCAL_LEARNER_ID,
  SchedulePolicyError,
  STATE_LABEL,
  TideRestoreError,
  TideScheduler,
  TideSteward,
  TOPRA_ASPECTS,
  type Aspect,
  type EventLogSnapshot,
  type Grade,
} from "@echo-shards/core";
import { suggestAspectGrade, type AspectReveal } from "@/app/review/actions";
import type { PoolId, ReviewPool } from "@/lib/content";
import { DAY_PLAN_KEY, type AcceptedDayPlan } from "@/components/day-desk";
import { isLearnerDebug } from "@/lib/learner-debug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Phase = "answer" | "grade" | "summary";

interface SavedRound {
  version: 2;
  aspect: Aspect;
  lexemeIds: string[];
  tide: { cards: unknown[]; logs: unknown[] };
  log: EventLogSnapshot;
  index: number;
  phase: Phase;
  typed: string;
  reveal: AspectReveal | null;
  why: string;
  batchId: string;
  lastDue: string | null;
  questId?: string;
}

interface Engine {
  tide: TideScheduler;
  log: AgentEventLog;
  steward: TideSteward;
  why: string;
  batchId: string;
  aspect: Aspect;
  questId?: string;
}

const GRADES: Grade[] = [1, 2, 3, 4];

function storageKey(pool: PoolId, aspect: Aspect): string {
  return `echo-shards.round.v2:${pool}:${aspect}`;
}

function readSaved(pool: PoolId, aspect: Aspect): SavedRound | null {
  const raw = localStorage.getItem(storageKey(pool, aspect));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SavedRound;
  if (parsed.version !== 2) {
    console.warn(
      "[echo-shards] ignoring review snapshot: unsupported version",
      parsed?.version,
    );
    return null;
  }
  if (!parsed.tide || !Array.isArray(parsed.tide.cards) || !Array.isArray(parsed.tide.logs)) {
    console.warn("[echo-shards] ignoring review snapshot: tide shape invalid");
    return null;
  }
  return parsed;
}

function writeSaved(pool: PoolId, aspect: Aspect, saved: SavedRound): void {
  localStorage.setItem(storageKey(pool, aspect), JSON.stringify(saved));
}

function parseAspect(raw: string | null): Aspect {
  if (raw === "meaning" || raw === "phonology_text" || raw === "form") return raw;
  // 解锁链默认义→形；裸链不接 form，避免闸门锁态永远碰不到。
  return "meaning";
}

export function ReviewSession({ pools }: { pools: ReviewPool[] }) {
  const search = useSearchParams();
  const aspectFromQuery = parseAspect(search.get("aspect"));
  const fromDay = search.get("from") === "day";
  const questFromQuery = search.get("quest") ?? undefined;
  const idsParam = search.get("ids") ?? "";
  const idsFromQuery = useMemo(
    () =>
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [idsParam],
  );

  const aspectPools = useMemo(
    () => pools.filter((pool) => pool.aspect === aspectFromQuery),
    [pools, aspectFromQuery],
  );
  const activePools = aspectPools.length > 0 ? aspectPools : pools;

  const [poolId, setPoolId] = useState<PoolId>(activePools[0]?.id ?? "seed");
  const pool = activePools.find((item) => item.id === poolId) ?? activePools[0];
  const aspect: Aspect = pool?.aspect ?? aspectFromQuery;
  const [nonce, setNonce] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [typed, setTyped] = useState("");
  const [reveal, setReveal] = useState<AspectReveal | null>(null);
  const [lastDue, setLastDue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [traceVersion, setTraceVersion] = useState(0);
  const [dayNote, setDayNote] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [freshGain, setFreshGain] = useState<string | null>(null);
  const [gateNote, setGateNote] = useState<string | null>(null);

  useEffect(() => {
    setShowDebug(isLearnerDebug());
  }, []);

  const filteredPrompts = useMemo(() => {
    if (!pool) return [];
    if (idsFromQuery.length === 0) return pool.prompts;
    const set = new Set(idsFromQuery);
    const filtered = pool.prompts.filter((prompt) => set.has(prompt.lexeme_id));
    return filtered.length > 0 ? filtered : pool.prompts;
  }, [pool, idsFromQuery]);

  const promptKey = filteredPrompts.map((prompt) => prompt.card_id).join("|");

  useEffect(() => {
    if (!pool) return;
    setGateNote(null);
    const ids = filteredPrompts.map((prompt) => prompt.lexeme_id);
    const tide = new TideScheduler({ requestRetention: 0.9 });
    const log = new AgentEventLog();
    let nextIndex = 0;
    let nextPhase: Phase = "answer";
    let nextTyped = "";
    let nextReveal: AspectReveal | null = null;
    let nextDue: string | null = null;
    let why = "";
    let batchId = "";
    let questId = questFromQuery;

    if (fromDay) {
      try {
        const raw = localStorage.getItem(DAY_PLAN_KEY);
        if (raw) {
          const plan = JSON.parse(raw) as AcceptedDayPlan;
          if (plan.version === 1) {
            log.restore(plan.event_log);
            questId = plan.variant.quest_id ?? questId;
            setDayNote(
              `来自日课提案 ${plan.variant.id} · ${plan.intent} · day ${plan.day_id}`,
            );
          }
        }
      } catch (err) {
        console.warn("[echo-shards] bad day-plan localStorage; ignoring", err);
      }
    }

    const saved = (() => {
      try {
        return readSaved(pool.id, aspect);
      } catch (err) {
        console.warn("[echo-shards] bad review localStorage JSON; discarding", err);
        return null;
      }
    })();

    const savedOk =
      !fromDay &&
      saved &&
      saved.aspect === aspect &&
      saved.lexemeIds.join("|") === ids.join("|") &&
      saved.tide.cards.length > 0;

    if (savedOk && saved) {
      try {
        // Client snapshot is untrusted; TideScheduler.restore replays logs.
        tide.restore(saved.tide);
        log.restore(saved.log);
        const complete = filteredPrompts.every((prompt) => tide.getCard(prompt.card_id));
        if (!complete) throw new Error("snapshot missing cards");
        nextIndex = saved.index;
        nextPhase = saved.phase;
        nextTyped = saved.typed;
        nextReveal = saved.reveal;
        nextDue = saved.lastDue;
        why = saved.why;
        batchId = saved.batchId;
        questId = saved.questId ?? questId;
      } catch (err) {
        const reason =
          err instanceof TideRestoreError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        console.warn(
          "[echo-shards] rejecting tainted tide snapshot; starting fresh enqueue",
          reason,
        );
        localStorage.removeItem(storageKey(pool.id, aspect));
        tide.restore({ cards: [], logs: [] });
        log.restore({ runs: [], proposals: [], events: [], eval_scores: [] });
      }
    }

    if (!why) {
      const steward = new TideSteward(tide, log);
      const now = new Date();
      let lexemeIds = ids;
      if (!fromDay || log.events.every((event) => event.event_type !== "proposal_accepted")) {
        const director = new CurriculumDirector(log);
        const proposal = director.proposeDayPlan({
          lexemeIds: ids,
          intent: `${aspect} tide`,
          questId,
          includePhonology: aspect === "phonology_text",
        });
        const variantId =
          aspect === "meaning"
            ? "v-meaning"
            : aspect === "phonology_text"
              ? "v-phonology"
              : questId
                ? "v-form-quest"
                : "v-form";
        const variant = director.accept(proposal.id, variantId);
        lexemeIds = variant.lexeme_ids;
      }
      for (const track of TOPRA_ASPECTS) {
        steward.enqueueIds(LOCAL_LEARNER_ID, lexemeIds, track, now);
      }
      const batch = steward.buildSessionBatch(LOCAL_LEARNER_ID, aspect, now, {
        applyWordTideGate: true,
      });
      why = steward.explainWhyTheseCards(batch);
      batchId = batch.id;
      const gated = steward.gateDue(now, aspect, LOCAL_LEARNER_ID);
      log.recordEvent({
        event_type: "session_start",
        payload: {
          batch_id: batch.id,
          aspect,
          from_day: fromDay,
          due_unchanged: true,
        },
      });
      // 闸门可能锁空 / 顺延：以 batch 为准，不对齐时不报硬错（旁注说明）。
      if (
        batch.card_ids.length > 0 &&
        batch.card_ids.join("|") !== filteredPrompts.map((prompt) => prompt.card_id).join("|") &&
        !gated.sameDayCollision &&
        gated.lockedOut.length === 0 &&
        gated.deferred.length === 0
      ) {
        setError("这一批卡片和提示对不上。重置后再练。");
      }
    }

    // 闸门旁注：存档恢复也要重算，否则形界锁态 / 音界休整永远露不出。
    // 用解锁态判断「整潮是否可练」，勿把「已练过、due 在未来」误判成锁。
    {
      const gateSteward = new TideSteward(tide, log);
      const gateNow = new Date();
      const gated = gateSteward.gateDue(gateNow, aspect, LOCAL_LEARNER_ID);
      const logs = tide.getLogs();
      const cards = tide.allCards();
      const fromPrompts = filteredPrompts.map((prompt) => prompt.lexeme_id).filter(Boolean);
      const fromCards = cards
        .filter((c) => c.aspect === aspect)
        .map((c) => c.lexeme_id);
      const idsForGate =
        fromPrompts.length > 0
          ? fromPrompts
          : fromCards.length > 0
            ? fromCards
            : cards.map((c) => c.lexeme_id).filter(Boolean);
      let note: string | null = null;
      if (aspect === "phonology_text" && !defaultIncludePhonology()) {
        note = WORD_TIDE_COPY.phonologyRest;
      } else {
        const anyOpen = idsForGate.some((lexemeId) => {
          if (!lexemeId) return false;
          return deriveAspectUnlockState(lexemeId, aspect, logs, undefined, cards) !== "locked";
        });
        if (!anyOpen) {
          const sample = idsForGate[0];
          note = sample
            ? apprenticeLockNote(sample, aspect, logs, undefined, cards) ??
              WORD_TIDE_COPY.needCrossNightShape
            : WORD_TIDE_COPY.needCrossNightShape;
        } else if (gated.sameDayCollision || gated.deferred.length > 0) {
          note = WORD_TIDE_COPY.sameDayDefer;
        }
      }
      setGateNote(note);
    }

    // Normalize learner why (migrates older localStorage copy that still had due/queue jargon).
    why = composeLearnerBatchWhy(aspect, filteredPrompts.length || 1);

    const steward = new TideSteward(tide, log);
    const snapshot: SavedRound = {
      version: 2,
      aspect,
      lexemeIds: ids,
      tide: tide.snapshot(),
      log: log.snapshot(),
      index: nextIndex,
      phase: nextPhase,
      typed: nextTyped,
      reveal: nextReveal,
      why,
      batchId,
      lastDue: nextDue,
      questId,
    };
    writeSaved(pool.id, aspect, snapshot);
    setEngine({ tide, log, steward, why, batchId, aspect, questId });
    setIndex(nextIndex);
    setPhase(nextPhase);
    setTyped(nextTyped);
    setReveal(nextReveal);
    setLastDue(nextDue);
    setTraceVersion((value) => value + 1);
  }, [pool, promptKey, nonce, aspect, fromDay, questFromQuery, filteredPrompts]);

  function persist(patch: Partial<SavedRound> & { phase: Phase; index: number }): void {
    if (!engine || !pool) return;
    writeSaved(pool.id, aspect, {
      version: 2,
      aspect,
      lexemeIds: filteredPrompts.map((prompt) => prompt.lexeme_id),
      tide: engine.tide.snapshot(),
      log: engine.log.snapshot(),
      typed,
      reveal,
      why: engine.why,
      batchId: engine.batchId,
      lastDue,
      questId: engine.questId,
      ...patch,
    });
  }

  async function onCheck(event: React.FormEvent) {
    event.preventDefault();
    if (!pool || busy) return;
    const prompt = filteredPrompts[index];
    if (!prompt) return;
    setBusy(true);
    setError(null);
    try {
      const next = await suggestAspectGrade(prompt.lexeme_id, typed, aspect);
      setReveal(next);
      setPhase("grade");
      persist({ phase: "grade", index, typed, reveal: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "对照失败");
    } finally {
      setBusy(false);
    }
  }

  function confirmGrade(grade: Grade) {
    if (!engine || !pool) return;
    const prompt = filteredPrompts[index];
    if (!prompt) return;
    setError(null);
    try {
      const result = engine.steward.rate(prompt.card_id, grade, new Date());
      new EvalSentinel(engine.log).scoreRetrieval(grade);
      const due = formatDueShanghai(result.card.review.due);
      const nextIndex = index + 1;
      const done = nextIndex >= filteredPrompts.length;
      if (done) {
        engine.log.recordEvent({
          event_type: "session_end",
          payload: { batch_id: engine.batchId, aspect },
        });
      }
      setLastDue(due);
      const note = apprenticeNoteAfterGrade({
        lexemeId: result.card.lexeme_id,
        aspect: result.card.aspect,
        grade,
        logs: engine.tide.getLogs(),
        now: new Date(),
        cards: engine.tide.allCards(),
      });
      setFreshGain(`${note} · 下次潮汐 ${due}`);
      setTraceVersion((value) => value + 1);
      if (done) {
        setPhase("summary");
        persist({ phase: "summary", index: nextIndex, lastDue: due, reveal: null, typed: "" });
      } else {
        setIndex(nextIndex);
        setPhase("answer");
        setTyped("");
        setReveal(null);
        persist({
          phase: "answer",
          index: nextIndex,
          typed: "",
          reveal: null,
          lastDue: due,
        });
      }
    } catch (cause) {
      if (cause instanceof SchedulePolicyError) {
        new EvalSentinel(engine.log).flagPolicyBreach("tide_steward", cause);
      }
      setError(cause instanceof Error ? cause.message : "评分没有写进调度器");
    }
  }

  function reset() {
    if (!pool) return;
    localStorage.removeItem(storageKey(pool.id, aspect));
    setError(null);
    setEngine(null);
    setNonce((value) => value + 1);
  }

  if (!pool) {
    return <p className="text-muted-foreground">没有可复习的词。</p>;
  }

  if (filteredPrompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>这一池还没有能上{ASPECT_LABEL[aspect]}的词</CardTitle>
          <CardDescription>这一界还没有可练的词。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!engine) {
    return <p className="text-muted-foreground">正在准备这一潮…</p>;
  }

  const prompt = filteredPrompts[Math.min(index, filteredPrompts.length - 1)]!;
  const runs = engine.log.runs.slice(-6);
  const titleText =
    aspect === "form" ? prompt.gloss_zh : prompt.orthography_hint ?? prompt.cloze;
  const cardDue = engine.tide.getCard(prompt.card_id)?.review.due;
  const cardDueLabel = cardDue ? formatDueShanghai(cardDue) : "尚未排期";

  const progressLabel = `${ASPECT_LABEL[aspect]} ${Math.min(index + 1, filteredPrompts.length)}/${filteredPrompts.length}`;
  const practiceBlocked = Boolean(
    gateNote &&
      (gateNote.includes("未开炉") ||
        gateNote.includes("休整") ||
        gateNote === WORD_TIDE_COPY.phonologyRest),
  );

  return (
    <div className="tide-beach flex flex-col gap-5">
      <details className="group rounded-lg border border-border/70 bg-card/40 open:bg-card/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span>本轮来源</span>
          <span className="text-xs group-open:hidden">展开</span>
          <span className="hidden text-xs group-open:inline">收起</span>
        </summary>
        <div className="space-y-3 border-t border-border/70 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            {activePools.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={item.id === pool.id ? "default" : "outline"}
                onClick={() => {
                  setError(null);
                  setEngine(null);
                  setPoolId(item.id);
                }}
              >
                {item.title}
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" render={<Link href="/day" />}>
              日课提案
            </Button>
          </div>
          {dayNote ? <p className="text-sm text-primary">{dayNote}</p> : null}
          <p className="text-sm text-muted-foreground">{pool.detail}</p>
          <p className="text-sm text-muted-foreground">{engine.why}</p>
        </div>
      </details>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {gateNote ? (
        <p
          role="status"
          className="rounded-lg border border-border/80 bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
        >
          {gateNote}
        </p>
      ) : null}

      {phase === "summary" ? (
        <Summary
          engine={engine}
          lastDue={lastDue}
          onReset={reset}
          showDebug={showDebug}
          freshGain={freshGain}
        />
      ) : practiceBlocked ? (
        <Card className="tide-stage realm-locked overflow-hidden border-border/60">
          <CardHeader className="gap-3 pb-3">
            <Badge className="realm-badge">
              {ASPECT_LABEL[aspect]} ·{" "}
              {gateNote?.includes("休整") ? "休整中" : "未开炉"}
            </Badge>
            <CardTitle className="tide-gloss text-balance">{gateNote}</CardTitle>
            <CardDescription className="text-base">
              {gateNote?.includes("休整")
                ? "这一界本阶段不开放试炼。"
                : `点开只读，无解锁按钮。${WORD_TIDE_COPY.needCrossNightShape}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" render={<Link href="/day" />}>
              回日课
            </Button>
            {aspect !== "meaning" ? (
              <Button type="button" variant="ghost" render={<Link href="/review?aspect=meaning" />}>
                去义界潮汐
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`tide-stage overflow-hidden border-primary/20 ${
            aspect === "meaning"
              ? "realm-meaning"
              : aspect === "phonology_text"
                ? "realm-sound"
                : "realm-form"
          }${freshGain?.includes("开炉") ? " realm-forge-open" : ""}`}
        >
          <CardHeader className="gap-3 pb-3">
            <div className="flex items-center justify-between gap-3">
              <Badge className="realm-badge">{progressLabel}</Badge>
              {prompt.cefr ? <Badge variant="outline">{prompt.cefr}</Badge> : null}
            </div>
            <CardTitle className="tide-gloss text-balance">{titleText}</CardTitle>
            <CardDescription className="text-base">{prompt.prompt}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {aspect === "form" ? (
              <p className="tide-cloze">{prompt.cloze}</p>
            ) : aspect === "meaning" ? (
              <p className="text-muted-foreground">写出中文义，再对照。</p>
            ) : (
              <p className="text-muted-foreground">
                写出文字音标；这一阶段不听录音。
              </p>
            )}
            {lastDue && phase === "answer" ? (
              <p className="text-sm text-muted-foreground">下次潮汐：{lastDue}</p>
            ) : null}
            {freshGain ? (
              <p role="status" className="rounded-lg border border-primary/30 bg-secondary/70 px-3 py-2 text-sm">
                {freshGain}
              </p>
            ) : null}

            {phase === "answer" ? (
              <form className="flex flex-col gap-3" onSubmit={onCheck}>
                <label htmlFor="answer" className="text-sm font-medium">
                  {aspect === "meaning"
                    ? "中文义"
                    : aspect === "phonology_text"
                      ? "文字音标"
                      : "拼写"}
                </label>
                <Input
                  id="answer"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={
                    aspect === "meaning"
                      ? "先写中文义，再对照"
                      : aspect === "phonology_text"
                        ? "先写 IPA / 音标，再对照"
                        : "先写出来，再对照"
                  }
                  className="h-11! text-base"
                />
                <div>
                  <Button type="submit" disabled={busy} className="h-11! px-4">
                    {busy
                      ? "对照中…"
                      : aspect === "meaning"
                        ? "对照释义"
                        : aspect === "phonology_text"
                          ? "对照音标"
                          : "对照拼写"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="tide-grade-dock flex flex-col gap-4">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <p className="text-sm text-muted-foreground">你写的</p>
                  <p className="text-lg">{typed.trim() || "（空）"}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{reveal?.expected_label}</p>
                  <p className="font-display text-2xl">
                    {aspect === "meaning"
                      ? reveal?.gloss_zh
                      : aspect === "phonology_text"
                        ? reveal?.phonetic_text
                        : reveal?.orthography}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {reveal?.orthography} · {reveal?.phonetic_text}
                    {aspect !== "meaning" && reveal?.gloss_zh ? ` · ${reveal.gloss_zh}` : ""}
                  </p>
                  <p className="mt-3">{reveal?.example_sentence}</p>
                  {reveal?.example_sentence_zh ? (
                    <p className="text-muted-foreground">{reveal.example_sentence_zh}</p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border/80 bg-secondary/50 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{progressLabel}</p>
                  <p className="mt-1 text-muted-foreground">
                    下次：{cardDueLabel}
                  </p>
                  {lastDue ? (
                    <p className="mt-1 text-muted-foreground">上一张下次潮汐：{lastDue}</p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  你点的等级才算数。
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="评分">
                  {GRADES.map((grade) => {
                    const label = GRADE_LABEL[grade];
                    const suggested = reveal?.suggested === grade;
                    return (
                      <Button
                        key={grade}
                        type="button"
                        variant={suggested ? "default" : "outline"}
                        className="h-14! flex-col gap-0"
                        onClick={() => confirmGrade(grade)}
                      >
                        <span>
                          {label.zh} · {label.en}
                        </span>
                        <span className="text-xs opacity-80">{suggested ? "建议" : ` ${grade}`}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showDebug ? (
        <Card size="sm">
          <CardHeader>
            <Badge variant="outline">debug</Badge>
            <CardTitle>调度记录</CardTitle>
            <CardDescription>
              Tide Steward 只调用 rate。retrieval_grade 写入 learning_events。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {composeBatchWhyDebug(aspect, filteredPrompts.length || 1)}
            </p>
            <ul className="flex flex-col gap-1 font-mono text-xs" data-trace={traceVersion}>
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap gap-x-3">
                  <span>{run.agent}</span>
                  <span>{run.tools.join(", ")}</span>
                  <span className="text-muted-foreground">{run.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Summary({
  engine,
  lastDue,
  onReset,
  showDebug,
  freshGain,
}: {
  engine: Engine;
  lastDue: string | null;
  onReset: () => void;
  showDebug: boolean;
  freshGain: string | null;
}) {
  const cards = engine.tide.allCards();
  const aspectLabel = ASPECT_LABEL[engine.aspect];
  const forgeOpen = Boolean(freshGain?.includes("开炉"));
  return (
    <div className="flex flex-col gap-4">
      <Card className={forgeOpen ? "realm-forge-open" : undefined}>
        <CardHeader>
          {forgeOpen ? (
            <Badge className="realm-badge w-fit">{freshGain?.split(" · ")[0]}</Badge>
          ) : null}
          <CardTitle className="font-display text-3xl">这一潮过去了</CardTitle>
          <CardDescription>
            {freshGain ? `${freshGain}。` : lastDue ? `最后一张下次潮汐 ${lastDue}。` : ""}
            {aspectLabel}这一潮走完了；可以去市集把词用出来。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={onReset}>
            再练一轮
          </Button>
          <Button
            type="button"
            variant="outline"
            render={
              <Link
                href={
                  engine.questId
                    ? `/quests?id=${encodeURIComponent(engine.questId)}`
                    : "/quests"
                }
              />
            }
          >
            去市集把词用出来
          </Button>
          <Button type="button" variant="ghost" render={<Link href="/day" />}>
            回日课
          </Button>
        </CardContent>
      </Card>
      {showDebug
        ? TOPRA_ASPECTS.map((track) => (
            <Card key={track} size="sm">
              <CardHeader>
                <Badge variant="outline">debug</Badge>
                <CardTitle>{ASPECT_LABEL[track]}</CardTitle>
                <CardDescription>
                  {track === engine.aspect ? "本轮评过" : "已入队，未进入本批"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {cards
                    .filter((card) => card.aspect === track)
                    .map((card) => (
                      <li
                        key={card.id}
                        className="flex flex-col gap-0.5 border-b border-border/70 pb-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between"
                      >
                        <span className="font-medium">{card.lexeme_id}</span>
                        <span className="text-sm text-muted-foreground">
                          {STATE_LABEL[card.review.state] ?? card.review.state} · reps {card.review.reps} ·
                          due {formatDueShanghai(card.review.due)}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))
        : null}
    </div>
  );
}
