"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ASPECT_LABEL, type Aspect } from "@echo-shards/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  hasPracticeLogs,
  hasTodayDayPlan,
  reviewShellEyebrow,
  reviewShellTitle,
} from "@/lib/learner-practice-local";

const RITUAL_LINE: Record<Aspect, string> = {
  form: "这一轮 · 只练拼写",
  meaning: "这一轮 · 只练意思",
  phonology_text: "这一轮 · 只练读音",
};

/**
 * Client chrome for /review: dynamic shell title, first-day eyebrow,
 * and bare-/review gate when today's day-plan is missing (PR5).
 */
export function ReviewPageShell({
  aspect,
  children,
}: {
  aspect: Aspect;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [hasLogs, setHasLogs] = useState(false);
  const [hasPlan, setHasPlan] = useState(true);

  useEffect(() => {
    const logs = hasPracticeLogs();
    const plan = hasTodayDayPlan();
    setHasLogs(logs);
    setHasPlan(plan);
    document.title = plan ? reviewShellTitle(logs) : "先安排今天的练习";
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="tide-beach mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
        <p className="text-muted-foreground">正在准备…</p>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="tide-beach mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            今天
          </p>
          <h1 className="font-display mt-2 text-2xl text-balance sm:text-3xl">
            先安排今天的练习
          </h1>
        </div>
        <Card>
          <CardHeader>
            <Badge variant="secondary">日课</Badge>
            <CardTitle className="font-display text-2xl">先安排今天的练习</CardTitle>
            <CardDescription>
              还没有今天的安排。先去日课认几个词，再来练意思。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" size="lg" render={<Link href="/day" />}>
              去日课
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="tide-beach mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {reviewShellEyebrow(hasLogs, ASPECT_LABEL[aspect])}
        </p>
        <h1 className="font-display mt-2 text-2xl text-balance sm:text-3xl">
          {RITUAL_LINE[aspect]}
        </h1>
      </div>
      {children}
    </div>
  );
}
