"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  type EventLogSnapshot,
  type Grade,
} from "@echo-shards/core";
import { suggestFormGrade, type FormReveal } from "@/app/review/actions";
import type { PoolId, ReviewPool } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Phase = "answer" | "grade" | "summary";

interface SavedRound {
  version: 1;
  lexemeIds: string[];
  tide: { cards: unknown[]; logs: unknown[] };
  log: EventLogSnapshot;
  index: number;
  phase: Phase;
  typed: string;
  reveal: FormReveal | null;
  why: string;
  batchId: string;
  lastDue: string | null;
}

interface Engine {
  tide: TideScheduler;
  log: AgentEventLog;
  steward: TideSteward;
  why: string;
  batchId: string;
}

const GRADES: Grade[] = [1, 2, 3, 4];

function storageKey(pool: PoolId): string {
  return `echo-shards.form-round.v1:${pool}`;
}

function readSaved(pool: PoolId): SavedRound | null {
  const raw = localStorage.getItem(storageKey(pool));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SavedRound;
  if (parsed.version !== 1) return null;
  return parsed;
}

function writeSaved(pool: PoolId, saved: SavedRound): void {
  localStorage.setItem(storageKey(pool), JSON.stringify(saved));
}

export function ReviewSession({ pools }: { pools: ReviewPool[] }) {
  const [poolId, setPoolId] = useState<PoolId>(pools[0]?.id ?? "seed");
  const pool = pools.find((item) => item.id === poolId) ?? pools[0];
  const [nonce, setNonce] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [typed, setTyped] = useState("");
  const [reveal, setReveal] = useState<FormReveal | null>(null);
  const [lastDue, setLastDue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [traceVersion, setTraceVersion] = useState(0);

  const promptKey = pool?.prompts.map((prompt) => prompt.card_id).join("|") ?? "";

  useEffect(() => {
    if (!pool) return;
    const ids = pool.prompts.map((prompt) => prompt.lexeme_id);
    const tide = new TideScheduler({ requestRetention: 0.9 });
    const log = new AgentEventLog();
    let nextIndex = 0;
    let nextPhase: Phase = "answer";
    let nextTyped = "";
    let nextReveal: FormReveal | null = null;
    let nextDue: string | null = null;
    let why = "";
    let batchId = "";

    const saved = (() => {
      try {
        return readSaved(pool.id);
      } catch {
        return null;
      }
    })();

    const savedOk =
      saved &&
      saved.lexemeIds.join("|") === ids.join("|") &&
      saved.tide.cards.length > 0;

    if (savedOk && saved) {
      try {
        tide.restore(saved.tide);
        log.restore(saved.log);
        const complete = pool.prompts.every((prompt) => tide.getCard(prompt.card_id));
        if (!complete) throw new Error("snapshot missing cards");
        nextIndex = saved.index;
        nextPhase = saved.phase;
        nextTyped = saved.typed;
        nextReveal = saved.reveal;
        nextDue = saved.lastDue;
        why = saved.why;
        batchId = saved.batchId;
      } catch {
        localStorage.removeItem(storageKey(pool.id));
        tide.restore({ cards: [], logs: [] });
        log.restore({ runs: [], proposals: [], events: [], eval_scores: [] });
      }
    }

    if (!why) {
      const director = new CurriculumDirector(log);
      const proposal = director.proposeDayPlan({
        lexemeIds: ids,
        intent: "form tide",
      });
      const variant = director.accept(proposal.id, "v-form");
      const steward = new TideSteward(tide, log);
      const now = new Date();
      for (const aspect of TOPRA_ASPECTS) {
        steward.enqueueIds(LOCAL_LEARNER_ID, variant.lexeme_ids, aspect, now);
      }
      const batch = steward.buildSessionBatch(LOCAL_LEARNER_ID, "form", now);
      why = steward.explainWhyTheseCards(batch);
      batchId = batch.id;
      log.recordEvent({
        event_type: "session_start",
        payload: { batch_id: batch.id, aspect: "form" },
      });
      if (batch.card_ids.join("|") !== pool.prompts.map((prompt) => prompt.card_id).join("|")) {
        setError("这一批卡片和提示对不上。重置后再练。");
      }
    }

    const steward = new TideSteward(tide, log);
    const snapshot: SavedRound = {
      version: 1,
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
    };
    writeSaved(pool.id, snapshot);
    setEngine({ tide, log, steward, why, batchId });
    setIndex(nextIndex);
    setPhase(nextPhase);
    setTyped(nextTyped);
    setReveal(nextReveal);
    setLastDue(nextDue);
    setTraceVersion((value) => value + 1);
  }, [pool, promptKey, nonce]);

  function persist(patch: Partial<SavedRound> & { phase: Phase; index: number }): void {
    if (!engine || !pool) return;
    writeSaved(pool.id, {
      version: 1,
      lexemeIds: pool.prompts.map((prompt) => prompt.lexeme_id),
      tide: engine.tide.snapshot(),
      log: engine.log.snapshot(),
      typed,
      reveal,
      why: engine.why,
      batchId: engine.batchId,
      lastDue,
      ...patch,
    });
  }

  async function onCheck(event: React.FormEvent) {
    event.preventDefault();
    if (!pool || busy) return;
    const prompt = pool.prompts[index];
    if (!prompt) return;
    setBusy(true);
    setError(null);
    try {
      const next = await suggestFormGrade(prompt.lexeme_id, typed);
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
    const prompt = pool.prompts[index];
    if (!prompt) return;
    setError(null);
    try {
      const result = engine.steward.rate(prompt.card_id, grade, new Date());
      new EvalSentinel(engine.log).scoreRetrieval(grade);
      const due = formatDueShanghai(result.card.review.due);
      const nextIndex = index + 1;
      const done = nextIndex >= pool.prompts.length;
      if (done) {
        engine.log.recordEvent({
          event_type: "session_end",
          payload: { batch_id: engine.batchId },
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
    localStorage.removeItem(storageKey(pool.id));
    setError(null);
    setEngine(null);
    setNonce((value) => value + 1);
  }

  if (!pool) {
    return <p className="text-muted-foreground">没有可复习的词。</p>;
  }

  if (pool.prompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>这一池还没有能上形界的词</CardTitle>
          <CardDescription>已审校义项为空。待审校词不会被填上假释义。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!engine) {
    return <p className="text-muted-foreground">正在把形界卡放上 TideScheduler…</p>;
  }

  const prompt = pool.prompts[Math.min(index, pool.prompts.length - 1)]!;
  const runs = engine.log.runs.slice(-6);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-2">
          {pools.map((item) => (
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
        </div>
        <p className="text-sm text-muted-foreground">
          request_retention {engine.tide.requestRetention} · 本机记忆，可重置
        </p>
      </div>
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
                {ASPECT_LABEL.form} · {Math.min(index + 1, pool.prompts.length)}/{pool.prompts.length}
              </Badge>
              {prompt.cefr ? <Badge variant="outline">{prompt.cefr}</Badge> : null}
            </div>
            <CardTitle className="font-display text-3xl">{prompt.gloss_zh}</CardTitle>
            <CardDescription>{prompt.prompt}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="font-display text-xl leading-relaxed">{prompt.cloze}</p>
            {lastDue ? (
              <p className="text-sm text-muted-foreground">上一张下次 due：{lastDue}（Asia/Shanghai）</p>
            ) : null}

            {phase === "answer" ? (
              <form className="flex flex-col gap-3" onSubmit={onCheck}>
                <label htmlFor="spelling" className="text-sm font-medium">
                  拼写
                </label>
                <Input
                  id="spelling"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="先写出来，再对照"
                  className="h-11! text-base"
                />
                <div>
                  <Button type="submit" disabled={busy} className="h-11! px-4">
                    {busy ? "对照中…" : "对照拼写"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <p className="text-sm text-muted-foreground">你写的</p>
                  <p className="text-lg">{typed.trim() || "（空）"}</p>
                  <p className="mt-3 text-sm text-muted-foreground">词形</p>
                  <p className="font-display text-2xl">{reveal?.orthography}</p>
                  <p className="mt-1 text-muted-foreground">{reveal?.phonetic_text}</p>
                  <p className="mt-3">{reveal?.example_sentence}</p>
                  {reveal?.example_sentence_zh ? (
                    <p className="text-muted-foreground">{reveal.example_sentence_zh}</p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  建议分来自拼写对照，Easy 留给你自己点。确认后的等级才进入 TideScheduler，due 由 ts-fsrs 计算。
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
            Tide Steward 只调用 rate。下面是本机 agent_runs，不是模型写的到期时间。
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
            义界和音界文字的卡还在，reps 仍是 0。语音不评分。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={onReset}>
            再练一轮
          </Button>
          <Button type="button" variant="outline" render={<Link href="/quests" />}>
            去交易所把词用出来
          </Button>
        </CardContent>
      </Card>
      {TOPRA_ASPECTS.map((aspect) => (
        <Card key={aspect} size="sm">
          <CardHeader>
            <CardTitle>{ASPECT_LABEL[aspect]}</CardTitle>
            <CardDescription>
              {aspect === "form" ? "本轮评过" : "已入队，未进入本批"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {cards
                .filter((card) => card.aspect === aspect)
                .map((card) => (
                  <li key={card.id} className="flex flex-col gap-0.5 border-b border-border/70 pb-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="font-medium">{card.lexeme_id}</span>
                    <span className="text-sm text-muted-foreground">
                      {STATE_LABEL[card.review.state] ?? card.review.state} · reps {card.review.reps} · due{" "}
                      {formatDueShanghai(card.review.due)}
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
