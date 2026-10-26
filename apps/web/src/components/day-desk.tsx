"use client";

import { useEffect, useMemo, useState } from "react";
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
import { isLearnerDebug } from "@/lib/learner-debug";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const DAY_PLAN_KEY = "echo-shards.day-plan.v1";
const DEFAULT_INTENT = "今天练形界拼写";
const DEFAULT_QUEST_ID = "echo-bazaar-info-gap-01";

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
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [selected, setSelected] = useState<string[]>(() =>
    options.filter((row) => row.source === "seed").slice(0, 5).map((row) => row.id),
  );
  const [proposal, setProposal] = useState<ProposalRecord | null>(null);
  const [log] = useState(() => new AgentEventLog());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const dayId = useMemo(() => dayIdShanghai(), []);

  useEffect(() => {
    setShowDebug(isLearnerDebug());
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((row) => row !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function buildProposal(lexemeIds: string[], nextIntent: string): ProposalRecord {
    log.runs.length = 0;
    log.proposals.length = 0;
    log.events.length = 0;
    log.evalScores.length = 0;
    const director = new CurriculumDirector(log);
    const phoneticReady = options
      .filter((row) => lexemeIds.includes(row.id))
      .every((row) => Boolean(row.phonetic_text?.trim()));
    return director.proposeDayPlan({
      lexemeIds,
      intent: nextIntent,
      questId: DEFAULT_QUEST_ID,
      includePhonology: phoneticReady,
    });
  }

  function propose() {
    setError(null);
    try {
      const next = buildProposal(selected, intent);
      setProposal(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提案失败");
    }
  }

  function persistAndGo(proposalRecord: ProposalRecord, variant: PlanVariant) {
    const saved: AcceptedDayPlan = {
      version: 1,
      day_id: proposalRecord.day_id,
      intent: proposalRecord.intent ?? intent,
      proposal_id: proposalRecord.id,
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
  }

  function accept(variantId: string) {
    if (!proposal) return;
    setError(null);
    try {
      const director = new CurriculumDirector(log);
      const variant = director.accept(proposal.id, variantId);
      persistAndGo(proposal, variant);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "接受失败");
    }
  }

  /** Default path: propose + accept form+quest (or form) in one click. */
  function acceptTodayOneClick() {
    setError(null);
    setBusy(true);
    try {
      const ids =
        selected.length > 0
          ? selected
          : options.filter((row) => row.source === "seed").slice(0, 5).map((row) => row.id);
      if (ids.length === 0) {
        setError("今天还没有可练的词");
        return;
      }
      const next = buildProposal(ids, intent.trim() || DEFAULT_INTENT);
      setProposal(next);
      const preferred =
        next.variants.find((row) => row.id === "v-form-quest") ??
        next.variants.find((row) => row.id === "v-form") ??
        next.variants[0];
      if (!preferred) {
        setError("没有可用提案");
        return;
      }
      const director = new CurriculumDirector(log);
      const variant = director.accept(next.id, preferred.id);
      persistAndGo(next, variant);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "接受失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">今日 · Asia/Shanghai</Badge>
            <Badge variant="outline">{dayId}</Badge>
          </div>
          <CardTitle className="font-display text-3xl">今日提案</CardTitle>
          <CardDescription>
            默认形界拼写并带上市集。点一次进潮汐。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            type="button"
            className="h-11! w-full sm:w-auto sm:min-w-[14rem]"
            disabled={busy || (selected.length === 0 && options.length === 0)}
            onClick={acceptTodayOneClick}
          >
            {busy ? "正在接过…" : "接过今日提案"}
          </Button>
          <p className="text-sm text-muted-foreground">
            需要改意图或词表时，展开下方进阶选项。
          </p>

          <details className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
              进阶：改意图与词表 · 已选 {selected.length}
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <label htmlFor="intent" className="text-sm font-medium">
                意图
              </label>
              <Textarea
                id="intent"
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                rows={2}
                placeholder="例如：今天练形界拼写"
              />
              <div>
                <p className="mb-2 text-sm font-medium">词表（最多 5）</p>
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
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={propose} disabled={selected.length === 0}>
                  生成 2–3 个提案再选
                </Button>
              </div>
            </div>
          </details>

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
                  接受这一条
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {proposal && showDebug ? (
        <Card size="sm">
          <CardHeader>
            <Badge variant="outline">debug</Badge>
            <CardTitle>写入 AgentEventLog</CardTitle>
            <CardDescription>
              session_proposals + learning_events（intent / proposal_accepted）。
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
