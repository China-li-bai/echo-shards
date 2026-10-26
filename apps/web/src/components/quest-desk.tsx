"use client";

import { useEffect, useState } from "react";
import {
  AgentEventLog,
  EchoBroker,
  composeAdaptTurn,
  type DealResult,
  type ElicitHit,
  type Quest,
} from "@echo-shards/core";
import type { QuestListItem } from "@/lib/content";
import { isLearnerDebug } from "@/lib/learner-debug";
import { appendQuestEventLogSnapshot } from "@/lib/camp-progress-local";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function emptyHits(quest: Quest): ElicitHit[] {
  return quest.must_elicit.map((item) => ({ item, hit: false, tokens: [] }));
}

export function QuestDesk({
  quest,
  catalog,
}: {
  quest: Quest;
  catalog: QuestListItem[];
}) {
  const [log] = useState(() => new AgentEventLog());
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<string[]>([]);
  const [hits, setHits] = useState<ElicitHit[]>(() => emptyHits(quest));
  const [deal, setDeal] = useState<DealResult | null>(null);
  const [trace, setTrace] = useState(0);
  const [abandoned, setAbandoned] = useState(false);
  const [nudge, setNudge] = useState(() => composeAdaptTurn(quest, emptyHits(quest), 0));
  const [showDebug, setShowDebug] = useState(false);
  const [freshGain, setFreshGain] = useState<string | null>(null);

  useEffect(() => {
    setShowDebug(isLearnerDebug());
  }, []);

  function submitTurn(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || deal?.success || abandoned) return;
    const nextTurns = [...turns, text];
    setTurns(nextTurns);
    setDraft("");
    const broker = new EchoBroker(log);
    const nextHits = broker.check(quest, nextTurns.join("\n"));
    setHits(nextHits);
    setNudge(broker.adaptTurn(quest, nextHits, nextTurns.length));
    setDeal(null);
    setFreshGain(null);
    setTrace((value) => value + 1);
  }

  function closeDeal() {
    if (deal?.success || abandoned) return;
    const result = new EchoBroker(log).finalizeDeal(quest, hits, turns.length);
    setDeal(result);
    // Persist broker events so camp ledger can derive shards/XP after refresh.
    appendQuestEventLogSnapshot(log.snapshot());
    if (result.success) {
      setFreshGain("成交亮起 · 残片 +1 · XP +50");
    }
    setTrace((value) => value + 1);
  }

  function abandon() {
    new EchoBroker(log).abandon(quest, "learner abandoned from /quests");
    setAbandoned(true);
    setTrace((value) => value + 1);
  }

  function reset() {
    const resetHits = emptyHits(quest);
    setDraft("");
    setTurns([]);
    setHits(resetHits);
    setNudge(composeAdaptTurn(quest, resetHits, 0));
    setDeal(null);
    setAbandoned(false);
    setFreshGain(null);
    log.runs.length = 0;
    log.events.length = 0;
    setTrace((value) => value + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>任务目录</CardTitle>
          <CardDescription>选一个摊位。</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {catalog.map((item) => (
              <li key={`${item.source}-${item.id}`} className="flex flex-wrap items-baseline gap-2">
                <a className="font-medium underline-offset-2 hover:underline" href={`/quests?id=${encodeURIComponent(item.id)}`}>
                  {item.title}
                </a>
                <Badge variant={item.source === "generated" ? "secondary" : "outline"}>
                  {item.source === "generated" ? "生成" : "种子"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>你知道</CardTitle>
          <CardDescription>{quest.roles.student}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-4">
            {quest.student_knows.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {showDebug ? (
        <Card size="sm">
          <CardHeader>
            <Badge variant="outline">debug</Badge>
            <CardTitle>摊主底牌</CardTitle>
            <CardDescription>{quest.roles.npc}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-4">
              {quest.npc_knows.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{quest.modality}</Badge>
            <Badge variant="outline">
              {turns.length}/{quest.max_turns} 回合
            </Badge>
          </div>
          <CardTitle className="font-display text-2xl">必须问出来</CardTitle>
          <CardDescription>
            用英文把下面这些信息问清。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {hits.map((hit) => (
              <li key={hit.item} className="flex items-start gap-2">
                <span
                  className={
                    hit.hit
                      ? "mt-0.5 grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground"
                      : "mt-0.5 grid size-5 place-items-center rounded-full bg-muted text-xs text-muted-foreground"
                  }
                  aria-hidden
                >
                  {hit.hit ? "✓" : ""}
                </span>
                <span>
                  {hit.item}
                  {hit.tokens.length > 0 ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      可试关键词 {hit.tokens.join(", ")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <p className="font-medium">摊位提示</p>
            <p className="text-muted-foreground">{nudge}</p>
          </div>

          <form className="flex flex-col gap-3" onSubmit={submitTurn}>
            <label htmlFor="turn" className="text-sm font-medium">
              你对摊主说
            </label>
            <Textarea
              id="turn"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder="What is the price? Can I bargain? When do you close?"
              disabled={deal?.success || abandoned}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.trim() || deal?.success || abandoned}>
                提交这一回合
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={turns.length === 0 || abandoned || Boolean(deal?.success)}
                onClick={closeDeal}
              >
                请求成交
              </Button>
              <Button type="button" variant="destructive" disabled={abandoned || deal?.success} onClick={abandon}>
                放弃
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                清空
              </Button>
            </div>
          </form>

          {turns.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {turns.map((turn, index) => (
                <li key={`${index}-${turn}`}>{turn}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">还没有回合。先问，再请求成交。</p>
          )}

          {abandoned ? (
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
              已放弃。想再试一次可以点清空。
            </p>
          ) : null}

          {deal ? (
            <p
              role="status"
              className={
                deal.success
                  ? "rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                  : "rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
              }
            >
              {deal.success ? "成交" : "未成交"} · {deal.reason}
            </p>
          ) : null}

          {freshGain ? (
            <p role="status" className="rounded-lg border border-primary/30 bg-secondary/70 px-3 py-2 text-sm">
              {freshGain}
            </p>
          ) : null}

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">任务编号</summary>
            <p className="mt-1 font-mono text-xs">{quest.id}</p>
          </details>
        </CardContent>
      </Card>

      {showDebug ? (
        <Card size="sm">
          <CardHeader>
            <Badge variant="outline">debug</Badge>
            <CardTitle>评分口径 · 事件</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3" data-trace={trace}>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{quest.rubric}</pre>
            <ul className="font-mono text-xs">
              {log.events.slice(-8).map((event) => (
                <li key={event.id}>
                  {event.event_type} · {String(event.payload.item ?? event.payload.reason ?? "")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
