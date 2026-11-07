import { dayIdShanghai } from "@echo-shards/core";
import type { AcceptedDayPlan } from "@/components/day-desk";
import { DAY_PLAN_STORAGE_KEY } from "@/lib/camp-progress-local";

function practiceParamsFromPlan(plan: AcceptedDayPlan): URLSearchParams {
  const params = new URLSearchParams({
    aspect: "meaning",
    from: "camp",
    variant: plan.variant.id,
    ids: plan.variant.lexeme_ids.join(","),
  });
  if (plan.variant.include_quest && plan.variant.quest_id) {
    params.set("quest", plan.variant.quest_id);
  }
  return params;
}

/** PR6 default: enter「先看一眼」before meaning recall (skip available when logs exist). */
function lookHrefFromPlan(plan: AcceptedDayPlan): string {
  return `/look?${practiceParamsFromPlan(plan).toString()}`;
}

/** PR1/PR2 main path: day desk, or look-ahead if today's plan is already accepted. */
export function readTodayPracticeHref(): string {
  try {
    const raw = localStorage.getItem(DAY_PLAN_STORAGE_KEY);
    if (!raw) return "/day";
    const plan = JSON.parse(raw) as AcceptedDayPlan;
    if (plan.version !== 1 || plan.day_id !== dayIdShanghai()) return "/day";
    if (!plan.variant?.lexeme_ids?.length) return "/day";
    return lookHrefFromPlan(plan);
  } catch {
    return "/day";
  }
}
