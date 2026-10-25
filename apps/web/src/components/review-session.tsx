"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AgentEventLog,
  ASPECT_LABEL,
  CurriculumDirector,
  EvalSentinel,
  formatDueShanghai,
  GRADE_LABEL,
  LOCAL_LEARNER_ID,
  SchedulePolicyError,
  STATE_LABEL,
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
  if (parsed.version !== 2) return null;
  return parsed;
}

function writeSaved(pool: PoolId, aspect: Aspect, saved: SavedRound): void {
  localStorage.setItem(storageKey(pool, aspect), JSON.stringify(saved));
}

function parseAspect(raw: string | null): Aspect {
  if (raw === "meaning" || raw === "phonology_text" || raw === "form") return raw;
  return "form";
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
      } catch {
        /* ignore bad day plan */
      }
    }

    const saved = (() => {
      try {
        return readSaved(pool.id, aspect);
      } catch {
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
      } catch {
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
        });
        const variantId =
          aspect === "meaning" ? "v-meaning" : questId ? "v-form-quest" : "v-form";
        const variant = director.accept(proposal.id, variantId);
        lexemeIds = variant.lexeme_ids;
      }
      for (const track of TOPRA_ASPECTS) {
        steward.enqueueIds(LOCAL_LEARNER_ID, lexemeIds, track, now);
      }
      const batch = steward.buildSessionBatch(LOCAL_LEARNER_ID, aspect, now);
      why = steward.explainWhyTheseCards(batch);
      batchId = batch.id;
      log.recordEvent({
        event_type: "session_start",
        payload: { batch_id: batch.id, aspect, from_day: fromDay },
      });
      if (batch.card_ids.join("|") !== filteredPrompts.map((prompt) => prompt.card_id).join("|")) {
        setError("这一批卡片和提示对不上。重置后再练。");
      }
    }

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
          <CardDescription>已审校义项为空。待审校词不会被填上假释义。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!engine) {
    return <p className="text-muted-foreground">正在把卡放上 TideScheduler…</p>;
  }

  const prompt = filteredPrompts[Math.min(index, filteredPrompts.length - 1)]!;
  const runs = engine.log.runs.slice(-6);
  const titleText =
    aspect === "meaning"
      ? prompt.orthography_hint ?? prompt.cloze
      : prompt.gloss_zh;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {activePools.map((item) => (
            <Button
              key={item.id}
              type="button"
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
          <Button type="button" variant="outline" render={<Link href="/day" />}>
            日课提案
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {ASPECT_LABEL[aspect]} · retention {engine.tide.requestRetention}
        </p>
      </div>
      {dayNote ? <p className="text-sm text-primary">{dayNote}</p> : null}
      <p className="max-w-2xl text-muted-foreground">{pool.detail}</p>
      <p className="max-w-2xl text-sm">{engine.why}</p>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {phase !== "summary" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary">
                {ASPECT_LABEL[aspect]} · {Math.min(index + 1, filteredPrompts.length)}/
                {filteredPrompts.length}
              </Badge>
              {prompt.cefr ? <Badge variant="outline">{prompt.cefr}</Badge> : null}
            </div>
            <CardTitle className="font-display text-3xl">{titleText}</CardTitle>
            <CardDescription>{prompt.prompt}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {aspect === "form" ? (
              <p className="font-display text-xl leading-relaxed">{prompt.cloze}</p>
            ) : (
              <p className="text-muted-foreground">写出中文义。不要编造；对照来自已审校 gloss。</p>
            )}
            {lastDue ? (
              <p className="text-sm text-muted-foreground">上一张下次 due：{lastDue}（Asia/Shanghai）</p>
            ) : null}

            {phase === "answer" ? (
              <form className="flex flex-col gap-3" onSubmit={onCheck}>
                <label htmlFor="answer" className="text-sm font-medium">
                  {aspect === "meaning" ? "中文义" : "拼写"}
                </label>
                <Input
                  id="answer"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={aspect === "meaning" ? "先写中文义，再对照" : "先写出来，再对照"}
                  className="h-11! text-base"
                />
                <div>
                  <Button type="submit" disabled={busy} className="h-11! px-4">
                    {busy ? "对照中…" : aspect === "meaning" ? "对照释义" : "对照拼写"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <p className="text-sm text-muted-foreground">你写的</p>
                  <p className="text-lg">{typed.trim() || "（空）"}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{reveal?.expected_label}</p>
                  <p className="font-display text-2xl">
                    {aspect === "meaning" ? reveal?.gloss_zh : reveal?.orthography}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {reveal?.orthography} · {reveal?.phonetic_text}
                  </p>
                  <p className="mt-3">{reveal?.example_sentence}</p>
                  {reveal?.example_sentence_zh ? (
                    <p className="text-muted-foreground">{reveal.example_sentence_zh}</p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  建议分来自 Forge Smith；确认后的等级才进入 TideScheduler.rate。
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
      ) : (
        <Summary engine={engine} lastDue={lastDue} onReset={reset} />
      )}

      <Card size="sm">
        <CardHeader>
          <CardTitle>调度记录</CardTitle>
          <CardDescription>
            Tide Steward 只调用 rate。retrieval_grade 写入 learning_events。
          </CardDescription>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}

function Summary({
  engine,
  lastDue,
  onReset,
}: {
  engine: Engine;
  lastDue: string | null;
  onReset: () => void;
}) {
  const cards = engine.tide.allCards();
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">这一潮过去了</CardTitle>
          <CardDescription>
            {lastDue ? `最后一张 due ${lastDue}。` : ""}
            其他 aspect 的卡还在，reps 仍是 0。语音不评分。
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
            去交易所把词用出来
          </Button>
          <Button type="button" variant="ghost" render={<Link href="/day" />}>
            回日课
          </Button>
        </CardContent>
      </Card>
      {TOPRA_ASPECTS.map((track) => (
        <Card key={track} size="sm">
          <CardHeader>
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
      ))}
    </div>
  );
}
