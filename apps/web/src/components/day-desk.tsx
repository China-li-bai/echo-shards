"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AgentEventLog,
  ASPECT_LABEL,
  CurriculumDirector,
  dayIdShanghai,
  type PlanVariant,
  type ProposalRecord,
} from "@echo-shards/core";
import type { DayLexemeOption } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const DAY_PLAN_KEY = "echo-shards.day-plan.v1";

export interface AcceptedDayPlan {
  version: 1;
  day_id: string;
  intent: string;
  proposal_id: string;
  variant: PlanVariant;
  accepted_at: string;
  event_log: ReturnType<AgentEventLog["snapshot"]>;
}

export function DayDesk({ options }: { options: DayLexemeOption[] }) {
  const router = useRouter();
  const [intent, setIntent] = useState("今天练拼写，顺带去市集把词问出来");
  const [selected, setSelected] = useState<string[]>(() =>
    options.filter((row) => row.source === "seed").slice(0, 5).map((row) => row.id),
  );
  const [proposal, setProposal] = useState<ProposalRecord | null>(null);
  const [log] = useState(() => new AgentEventLog());
  const [error, setError] = useState<string | null>(null);
  const dayId = useMemo(() => dayIdShanghai(), []);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((row) => row !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function propose() {
    setError(null);
    try {
      log.runs.length = 0;
      log.proposals.length = 0;
      log.events.length = 0;
      log.evalScores.length = 0;
      const director = new CurriculumDirector(log);
      const next = director.proposeDayPlan({
        lexemeIds: selected,
        intent,
        questId: "echo-bazaar-info-gap-01",
      });
      setProposal(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提案失败");
    }
  }

  function accept(variantId: string) {
    if (!proposal) return;
    setError(null);
    try {
      const director = new CurriculumDirector(log);
      const variant = director.accept(proposal.id, variantId);
      const saved: AcceptedDayPlan = {
        version: 1,
        day_id: proposal.day_id,
        intent: proposal.intent ?? intent,
        proposal_id: proposal.id,
        variant,
        accepted_at: new Date().toISOString(),
        event_log: log.snapshot(),
      };
      localStorage.setItem(DAY_PLAN_KEY, JSON.stringify(saved));
      const params = new URLSearchParams({
        aspect: variant.aspect,
        from: "day",
        variant: variant.id,
      });
      if (variant.include_quest && variant.quest_id) {
        params.set("quest", variant.quest_id);
      }
      params.set("ids", variant.lexeme_ids.join(","));
      router.push(`/review?${params.toString()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "接受失败");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">dayId · Asia/Shanghai</Badge>
            <Badge variant="outline">{dayId}</Badge>
            <Badge variant="outline">load ≤ 5 · 单 aspect</Badge>
          </div>
          <CardTitle className="font-display text-3xl">今天想练什么</CardTitle>
          <CardDescription>
            Curriculum Director 只提案，不自动开潮。接受后才进入 Tide Steward / Forge Smith。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label htmlFor="intent" className="text-sm font-medium">
            意图
          </label>
          <Textarea
            id="intent"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            rows={2}
            placeholder="例如：今天练拼写，顺带去市集把词问出来"
          />
          <div>
            <p className="mb-2 text-sm font-medium">词表（最多 5）· 已选 {selected.length}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((row) => {
                const on = selected.includes(row.id);
                return (
                  <Button
                    key={row.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => toggle(row.id)}
                  >
                    {row.orthography}
                    <span className="ml-1 opacity-70">{row.source}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <Button type="button" onClick={propose} disabled={selected.length === 0}>
              生成 2–3 个提案
            </Button>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {proposal ? (
        <div className="grid gap-3 md:grid-cols-3">
          {proposal.variants.map((variant) => (
            <Card key={variant.id} className="flex flex-col">
              <CardHeader>
                <Badge variant="secondary">
                  {ASPECT_LABEL[variant.aspect]} · load {variant.load}
                </Badge>
                <CardTitle className="font-display text-xl">{variant.label}</CardTitle>
                <CardDescription>
                  {variant.lexeme_ids.join(", ")}
                  {variant.include_quest ? ` · quest ${variant.quest_id}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button type="button" className="w-full" onClick={() => accept(variant.id)}>
                  明确接受
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {proposal ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>写入 AgentEventLog</CardTitle>
            <CardDescription>
              session_proposals + learning_events（intent / proposal_accepted）。无托管
              Supabase。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {log.events.map((event) => (
                <li key={event.id}>
                  {event.event_type} · {JSON.stringify(event.payload).slice(0, 120)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export { DAY_PLAN_KEY };
