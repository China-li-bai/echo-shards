"use client";

import { useEffect, useState } from "react";
import {
  emptyCampProgress,
  type CampProgress,
} from "@echo-shards/core";
import { getCampProgressFromLocalStorage } from "@/lib/camp-progress-local";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface CampLedgerFloor {
  ready: number;
  lemmas: number;
  partial: number;
  pending: number;
  forms: number;
  license: string;
  coverageNote: string;
}

type LoadState =
  | { status: "loading"; progress: CampProgress; sourceLabel: string; eventCount: number }
  | { status: "ready"; progress: CampProgress; sourceLabel: string; eventCount: number };

function isColdStart(progress: CampProgress, eventCount: number): boolean {
  return (
    eventCount === 0 ||
    (progress.xp === 0 &&
      progress.streak_days === 0 &&
      progress.shards === 0 &&
      progress.session_count === 0 &&
      progress.retrieval_count === 0 &&
      progress.quest_success_count === 0)
  );
}

export function CampLedger({ floor }: { floor: CampLedgerFloor }) {
  const [state, setState] = useState<LoadState>(() => ({
    status: "loading",
    progress: emptyCampProgress(),
    sourceLabel: "读取练习记录…",
    eventCount: 0,
  }));

  useEffect(() => {
    const view = getCampProgressFromLocalStorage();
    setState({
      status: "ready",
      progress: view.progress,
      sourceLabel: view.sourceLabel,
      eventCount: view.eventCount,
    });
  }, []);

  const { progress, sourceLabel, eventCount } = state;
  const cold = isColdStart(progress, eventCount);
  const camp = [
    { label: "连续天数", value: progress.streak_days, note: "按练习日算" },
    { label: "会话", value: progress.session_count, note: "走完一轮算一次" },
    { label: "经验", value: progress.xp, note: "潮汐与市集累计" },
    { label: "残片", value: progress.shards, note: "营地进度" },
  ];
  const stats = [
    { label: "常用词总数", value: floor.lemmas, note: "见页脚" },
    { label: "可以练的词", value: floor.ready, note: "有中文义可练" },
    { label: "还在补", value: floor.pending, note: "还缺中文义" },
    { label: "写法变化", value: floor.forms, note: "拼写变化" },
  ];

  return (
    <details className="group rounded-xl border border-border bg-card/80 open:bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">营地账本</Badge>
          {cold ? (
            <span className="text-muted-foreground">
              还没开始 · 词表里 {floor.ready}/{floor.lemmas} 可练
            </span>
          ) : (
            <span className="text-muted-foreground">
              等级 {progress.camp_level} · 连续 {progress.streak_days} 天 · 经验 {progress.xp} · 残片{" "}
              {progress.shards} · 可练 {floor.ready}/{floor.lemmas}
            </span>
          )}
        </span>
        <span className="text-muted-foreground group-open:hidden">展开</span>
        <span className="hidden text-muted-foreground group-open:inline">收起</span>
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">营地进度</p>
            <Badge variant="outline">{sourceLabel}</Badge>
            {state.status === "ready" ? (
              <span className="text-xs text-muted-foreground">
                {cold
                  ? "走完日课或潮汐后，这里会亮起来"
                  : eventCount === 0
                    ? "还没有进度"
                    : `记了 ${eventCount} 次练习`}
              </span>
            ) : null}
          </div>
          {cold ? (
            <Card size="sm">
              <CardHeader>
                <CardDescription>学徒进度</CardDescription>
                <CardTitle className="font-display text-2xl">还没开始</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                练完一轮或市集成交后，这里会出现天数、经验和残片。
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {camp.map((stat) => (
                <Card key={stat.label} size="sm">
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                    <CardTitle className="font-display text-3xl tabular-nums">{stat.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">{stat.note}</CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
            常用词表 · {floor.license}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} size="sm">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="font-display text-3xl tabular-nums">{stat.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">{stat.note}</CardContent>
              </Card>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          进度来自你在日课、潮汐和市集里的练习。
        </p>
      </div>
    </details>
  );
}
