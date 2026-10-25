"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  emptyShardWall,
  GRADE_LABEL,
  type Grade,
  type ShardLitView,
  type ShardWallView,
} from "@echo-shards/core";
import {
  getShardWallFromLocalStorage,
  resolveLexemeLabel,
} from "@/lib/shard-wall-local";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface FormShardWallProps {
  /** lexeme_id → orthography / display lemma */
  labels: Record<string, string>;
  /** quest_id → target lexeme ids (fallback for older deals without payload ids) */
  questTargetsById: Record<string, string[]>;
}

function formatSuccessTrail(shard: ShardLitView): string {
  const samples = [...shard.success_samples].reverse().slice(0, 3);
  if (samples.length === 0) return "尚无跨日 Good / Easy";
  const bits = samples.map((s) => {
    const grade = GRADE_LABEL[(s.grade as Grade) ?? 3] ?? { zh: "记得", en: "Good" };
    return `${s.day_id} ${grade.en}`;
  });
  return `跨日提取 ${shard.successful_days.length} 次 · 最近：${bits.join(" · ")}`;
}

function wallMeta(view: ShardWallView): string {
  if (view.cold) return "残片安静着";
  const parts: string[] = [];
  if (view.newly_lit_today_count > 0) {
    parts.push(`今日新亮 ${view.newly_lit_today_count}`);
  }
  parts.push(`累计亮 ${view.lit_count}`);
  if (view.seal_count > 0) {
    parts.push(`印记 ${view.seal_count}`);
  }
  if (view.far_shore.visible) {
    parts.push("远岸隐约");
  }
  return parts.join(" · ");
}

export function FormShardWall({ labels, questTargetsById }: FormShardWallProps) {
  const [view, setView] = useState<ShardWallView>(() => emptyShardWall());
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const next = getShardWallFromLocalStorage({ questTargetsById });
    setView(next);
    setReady(true);
  }, [questTargetsById]);

  useEffect(() => {
    if (!selectedId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const selected = useMemo(
    () => view.shards.find((s) => s.lexeme_id === selectedId) ?? null,
    [view.shards, selectedId],
  );

  function openShard(shard: ShardLitView) {
    // Faint seal bricks and lit shards both open dual-track detail
    setSelectedId(shard.lexeme_id);
  }

  function closeSheet() {
    setSelectedId(null);
  }

  return (
    <>
      <Card className="realm-form wall-card overflow-hidden border-primary/20 bg-card/90">
        <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="realm-badge">形界</Badge>
              <CardTitle className="font-display text-2xl">形界残片墙</CardTitle>
            </div>
            <CardDescription className="max-w-xl text-sm leading-relaxed">
              本机潮汐痕迹 · 跨日提取 ≥2 才亮灯 · 这不是「已掌握」
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right" aria-live="polite">
            {ready ? wallMeta(view) : "读取本机痕迹…"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="wall-stage relative overflow-hidden rounded-xl border border-dashed border-border/80">
            {view.far_shore.visible ? (
              <div className="far-shore visible" aria-hidden="true">
                <div className="far-shore-glow" />
                <div className="far-shore-horizon" />
                {[22, 38, 51, 64, 78].slice(0, Math.min(5, Math.max(2, view.far_shore.due_soon_count))).map((left) => (
                  <span key={left} className="far-dot" style={{ left: `${left}%` }} />
                ))}
                <span className="far-label">远岸 · 将至潮汐</span>
              </div>
            ) : null}

            <div className="shard-grid relative z-[1] flex min-h-[140px] flex-wrap items-center justify-center gap-2.5 px-3.5 py-5 pb-8">
              {!ready ? (
                <p className="text-sm text-muted-foreground">读取本机潮汐痕迹…</p>
              ) : view.cold ? (
                <div className="empty-invite mx-auto max-w-xs px-5 py-9 text-center text-muted-foreground">
                  <div
                    className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-xl border border-dashed border-border text-xl text-muted-foreground/60"
                    aria-hidden
                  >
                    ◇
                  </div>
                  <p className="text-sm leading-relaxed">
                    走完潮汐后，这里会亮起几块残片。
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    一盏灯 = 跨日成功提取 ≥2（不同日历日的 Good / Easy）。一次 Good 不会亮。
                  </p>
                </div>
              ) : (
                view.shards.map((shard) => {
                  const label = resolveLexemeLabel(shard.lexeme_id, labels);
                  const classes = [
                    "shard",
                    shard.lit ? "lit" : "faint-seal",
                    shard.newly_lit_today ? "new-today" : "",
                    shard.has_seal ? "has-seal" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={shard.lexeme_id}
                      type="button"
                      className={classes}
                      aria-label={`${label}${shard.newly_lit_today ? " · 今日新亮" : ""}${shard.has_seal ? " · 成交印记" : ""}`}
                      onClick={() => openShard(shard)}
                    >
                      <span className="shard-word">{label}</span>
                      <span className="shard-aspect">形</span>
                      {shard.has_seal ? (
                        <span className="shard-seal" title="成交印记">
                          印
                        </span>
                      ) : null}
                      {shard.newly_lit_today ? (
                        <span className="shard-new-tag">今日新亮</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {!view.cold ? (
            <div className="flex flex-wrap gap-3.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-swatch legend-lit" aria-hidden />
                已亮（跨日痕迹）
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-swatch legend-new" aria-hidden />
                今日新亮
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-swatch legend-seal" aria-hidden />
                成交印记
              </span>
              {view.far_shore.visible ? (
                <span className="inline-flex items-center gap-1.5">
                  <i className="legend-swatch legend-far" aria-hidden />
                  远岸将至（不可点）
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <div
          className="shard-sheet-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shard-sheet-lemma"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <div className="shard-sheet">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id="shard-sheet-lemma" className="font-display text-3xl tracking-tight">
                  {resolveLexemeLabel(selected.lexeme_id, labels)}
                </p>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  形 · 拼写痕迹
                </span>
              </div>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-lg text-muted-foreground hover:bg-muted"
                aria-label="关闭"
                onClick={closeSheet}
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-2.5">
              <div className="rounded-[10px] border border-border bg-secondary/40 px-3.5 py-3">
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  记得
                  <span className="rounded border border-border bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                    潮汐 · 本机痕迹
                  </span>
                </h4>
                <p className="text-sm">{formatSuccessTrail(selected)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  规则：不同日历日（Asia/Shanghai）各至少一次 Good/Easy，才算亮灯。一次 Good 不亮。
                </p>
              </div>
              <div className="rounded-[10px] border border-border bg-secondary/40 px-3.5 py-3">
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  用出来过
                  <span className="rounded border border-border bg-card px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                    市集 · 成交印记
                  </span>
                </h4>
                <p className="text-sm">
                  {selected.deal_count > 0
                    ? `市集成交 ${selected.deal_count} 次 · 问价残片时留下印记`
                    : "尚未成交 · 记得不等于用出来过"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  与「记得」分轨；有印记也不等于已掌握。
                </p>
              </div>
            </div>

            <div className="mt-3.5 rounded-lg border border-[oklch(0.88_0.04_60)] bg-[oklch(0.96_0.02_60)] px-3 py-2.5 text-xs text-[oklch(0.45_0.08_40)]">
              这不是「已掌握」。亮灯只说明本机留下了跨日提取痕迹；遗忘仍会发生，远岸仍会靠近。
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                onClick={closeSheet}
              >
                就这样
              </button>
              <Link
                href="/review?aspect=form"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                去潮汐再碰一下
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
