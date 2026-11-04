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

/** PR1/PR2 main path: day desk, or meaning review if today's plan is already accepted. */
export function readTodayPracticeHref(): string {
  try {
    const raw = localStorage.getItem(DAY_PLAN_STORAGE_KEY);
    if (!raw) return "/day";
    const plan = JSON.parse(raw) as AcceptedDayPlan;
    if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return "/day";
    if (!plan.variant?.lexeme_ids?.length) return "/day";
    return reviewHrefFromPlan(plan);
  } catch {
    return "/day";
  }
}
