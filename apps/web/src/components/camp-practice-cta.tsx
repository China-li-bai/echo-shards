"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dayIdShanghai } from "@echo-shards/core";
import type { AcceptedDayPlan } from "@/components/day-desk";
import { DAY_PLAN_STORAGE_KEY } from "@/lib/camp-progress-local";

function reviewHrefFromPlan(plan: AcceptedDayPlan): string {
  const params = new URLSearchParams({
    aspect: "meaning",
    from: "camp",
    variant: plan.variant.id,
    ids: plan.variant.lexeme_ids.join(","),
  });
  if (plan.variant.include_quest && plan.variant.quest_id) {
    params.set("quest", plan.variant.quest_id);
  }
  return `/review?${params.toString()}`;
}

function readTodayPracticeHref(): string {
  try {
    const raw = localStorage.getItem(DAY_PLAN_STORAGE_KEY);
    if (!raw) return "/day";
    const plan = JSON.parse(raw) as AcceptedDayPlan;
    if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return "/day";
    if (!plan.variant?.lexeme_ids?.length) return "/day";
    // 当日已接且有词可练 → 直达意思面
    return reviewHrefFromPlan(plan);
  } catch {
    return "/day";
  }
}

/** Camp primary CTA: one solid button; bazaar is a text link. */
export function CampPracticeCta() {
  const [href, setHref] = useState("/day");

  useEffect(() => {
    setHref(readTodayPracticeHref());
  }, []);

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        开始今天的练习
      </Link>
      <Link
        href="/quests"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        去市集问价
      </Link>
    </div>
  );
}
