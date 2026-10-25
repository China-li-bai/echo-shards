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
    sourceLabel: "来自本机学习事件…",
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
    { label: "连续天数", value: progress.streak_days, note: "Asia/Shanghai · 事件推导" },
    { label: "会话", value: progress.session_count, note: "session_end 事件" },
    { label: "XP", value: progress.xp, note: "retrieval + quest" },
    { label: "残片 shards", value: progress.shards, note: "001 progress 字段" },
  ];
  const stats = [
    { label: "口语地板 lemmas", value: floor.lemmas, note: "NGSL-Spoken 1.2" },
    { label: "义项已就绪", value: floor.ready, note: "含音标、中文义、例句" },
    { label: "待审校", value: floor.pending, note: "不编造 gloss" },
    { label: "词形变体", value: floor.forms, note: "屈折 / 拼写" },
  ];

  return (
    <details className="group rounded-xl border border-border bg-card/80 open:bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">营地账本</Badge>
          {cold ? (
            <span className="text-muted-foreground">尚未开铸 · 地板 {floor.ready}/{floor.lemmas} 就绪</span>
          ) : (
            <span className="text-muted-foreground">
              等级 {progress.camp_level} · 连续 {progress.streak_days} 天 · XP {progress.xp} · 残片{" "}
              {progress.shards} · 地板 {floor.ready}/{floor.lemmas} 就绪
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
                    ? "无服务端账本 · 真实 0"
                    : `${eventCount} 条本机事件`}
              </span>
            ) : null}
          </div>
          {cold ? (
            <Card size="sm">
              <CardHeader>
                <CardDescription>学徒进度</CardDescription>
                <CardTitle className="font-display text-2xl">尚未开铸</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                完成第一次拼写对照或市集成交后，连续天数、XP 与残片会显示在这里。
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
            口语地板 · {floor.license}
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
          词库 / 审校 / 评估在顶栏「工坊」。进度来自本机日课、潮汐与交易所成交事件。地板说明：{floor.coverageNote}。
        </p>
      </div>
    </details>
  );
}
