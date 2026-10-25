"use client";

import { useState } from "react";
import {
  AgentEventLog,
  EchoBroker,
  type DealResult,
  type ElicitHit,
  type Quest,
} from "@echo-shards/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function QuestDesk({ quest }: { quest: Quest }) {
  const [log] = useState(() => new AgentEventLog());
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<string[]>([]);
  const [hits, setHits] = useState<ElicitHit[]>(() =>
    quest.must_elicit.map((item) => ({ item, hit: false, tokens: [] })),
  );
  const [deal, setDeal] = useState<DealResult | null>(null);
  const [trace, setTrace] = useState(0);

  function submitTurn(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || deal?.success) return;
    const nextTurns = [...turns, text];
    setTurns(nextTurns);
    setDraft("");
    setHits(new EchoBroker(log).check(quest, nextTurns.join("\n")));
    setDeal(null);
    setTrace((value) => value + 1);
  }

  function closeDeal() {
    const result = new EchoBroker(log).finalizeDeal(quest, hits, turns.length);
    setDeal(result);
    setTrace((value) => value + 1);
  }

  function reset() {
    setDraft("");
    setTurns([]);
    setHits(quest.must_elicit.map((item) => ({ item, hit: false, tokens: [] })));
    setDeal(null);
    log.runs.length = 0;
    log.events.length = 0;
    setTrace((value) => value + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
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
        <Card size="sm">
          <CardHeader>
            <CardTitle>摊主知道</CardTitle>
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
      </div>

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
            Echo Broker 只用英文词干勾选 must_elicit。纯中文过不了关。这里没有聊天模型，也不会改 FSRS due。
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
                      关键词 {hit.tokens.join(", ")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

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
              disabled={deal?.success}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.trim() || deal?.success}>
                提交这一回合
              </Button>
              <Button type="button" variant="outline" disabled={turns.length === 0} onClick={closeDeal}>
                请求成交
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
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>评分口径</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground" data-trace={trace}>
          {quest.rubric}
        </CardContent>
      </Card>
    </div>
  );
}
