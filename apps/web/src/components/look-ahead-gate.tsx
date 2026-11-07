"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { dayIdShanghai } from "@echo-shards/core";
import type { LookCard } from "@/lib/content";
import { DAY_PLAN_STORAGE_KEY } from "@/lib/camp-progress-local";
import { hasPracticeLogs } from "@/lib/learner-practice-local";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function buildReviewHref(search: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["aspect", "from", "variant", "ids", "quest"] as const) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  if (!params.has("aspect")) params.set("aspect", "meaning");
  if (!params.has("from")) params.set("from", "day");
  return `/review?${params.toString()}`;
}

function readPlanIds(): string[] {
  try {
    const raw = localStorage.getItem(DAY_PLAN_STORAGE_KEY);
    if (!raw) return [];
    const plan = JSON.parse(raw) as {
      version?: number;
      day_id?: string;
      variant?: { lexeme_ids?: string[] };
    };
    if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return [];
    return Array.isArray(plan.variant?.lexeme_ids) ? plan.variant.lexeme_ids : [];
  } catch {
    return [];
  }
}

/**
 * PR6 recognition half-beat (学徒名「先看一眼」).
 * Walk English + gloss_zh + optional example, then enter meaning recall.
 */
export function LookAheadGate({ cards }: { cards: LookCard[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const [index, setIndex] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [planIds, setPlanIds] = useState<string[]>([]);

  useEffect(() => {
    setCanSkip(hasPracticeLogs());
    setPlanIds(readPlanIds());
  }, []);

  const idsFromQuery = useMemo(
    () =>
      (search.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [search],
  );

  const activeCards = useMemo(() => {
    const prefer = idsFromQuery.length > 0 ? idsFromQuery : planIds;
    if (prefer.length === 0) return cards;
    const byId = new Map(cards.map((card) => [card.id, card]));
    const picked: LookCard[] = [];
    for (const id of prefer.slice(0, 5)) {
      const card = byId.get(id);
      if (card) picked.push(card);
    }
    return picked.length > 0 ? picked : cards;
  }, [cards, idsFromQuery, planIds]);

  const reviewHref = useMemo(() => {
    const href = buildReviewHref(search);
    // Ensure ids stay aligned when we only had plan-local ids.
    if (!search.get("ids") && activeCards.length > 0) {
      const params = new URLSearchParams(href.split("?")[1] ?? "");
      params.set("ids", activeCards.map((card) => card.id).join(","));
      return `/review?${params.toString()}`;
    }
    return href;
  }, [search, activeCards]);

  function goReview() {
    router.push(reviewHref);
  }

  if (activeCards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <Badge variant="secondary">日课</Badge>
          <CardTitle className="font-display text-2xl">先看一眼</CardTitle>
          <CardDescription>
            今天还没有可看的词。先回日课安排今天的练习。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="lg" render={<Link href="/day" />}>
            去日课
          </Button>
        </CardContent>
      </Card>
    );
  }

  const atEnd = index >= activeCards.length;
  const card = atEnd
    ? activeCards[activeCards.length - 1]!
    : activeCards[Math.min(index, activeCards.length - 1)]!;
  const progressLabel = `${Math.min(index + 1, activeCards.length)}/${activeCards.length}`;

  return (
    <Card className="tide-stage realm-meaning overflow-hidden border-primary/20">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className="realm-badge">先看一眼</Badge>
          <span className="text-sm text-muted-foreground">{progressLabel}</span>
        </div>
        <CardTitle className="font-display text-2xl">先看一眼</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          看一眼意思；等下自己想起来。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!atEnd ? (
          <>
            <div className="rounded-lg bg-muted px-4 py-4">
              <p className="font-display text-3xl tracking-tight">{card.orthography}</p>
              <p className="mt-3 text-xl font-medium leading-snug">{card.gloss_zh}</p>
              {card.example_sentence ? (
                <div className="mt-4 space-y-1 border-t border-border/60 pt-3">
                  <p className="text-base leading-relaxed">{card.example_sentence}</p>
                  {card.example_sentence_zh ? (
                    <p className="text-sm text-muted-foreground">{card.example_sentence_zh}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3">
              <Button
                type="button"
                size="lg"
                className="h-11! px-4"
                onClick={() => setIndex((value) => value + 1)}
              >
                下一个
              </Button>
              {canSkip ? (
                <Button type="button" variant="outline" onClick={goReview}>
                  已经练过 · 直接回忆
                </Button>
              ) : null}
              <Link
                href="/day"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                回日课
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-base text-muted-foreground">
              本轮 {activeCards.length} 个词都看过了。接下来试着写出中文义。
            </p>
            <Button type="button" size="lg" className="h-11! px-4" onClick={goReview}>
              看过了，试着写意思
            </Button>
            {canSkip ? (
              <Button type="button" variant="outline" onClick={goReview}>
                已经练过 · 直接回忆
              </Button>
            ) : null}
            <Link
              href="/day"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              回日课
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
