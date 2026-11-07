"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hasFirstMeaningSuccess } from "@/lib/learner-practice-local";

export interface CampStep {
  n: string;
  href: string;
  title: string;
  hint: string;
  icon: string;
  /** When true, gated until hasFirstMeaningSuccess (PR7). */
  requiresFirstSuccess?: boolean;
}

/**
 * Camp「今日步骤」次文链接：潮汐 / 市集在首成功前灰态不可点（合签旁注）。
 * 与顶栏同一判据，避免只改 header 漏主链旁入口。
 */
export function CampTodaySteps({ steps }: { steps: readonly CampStep[] }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    setUnlocked(hasFirstMeaningSuccess());
  }, []);

  const open = unlocked === true;

  return (
    <ol
      className="grid gap-1.5 border-t border-border/60 pt-3 sm:grid-cols-3"
      aria-label="今日步骤（次要）"
    >
      {steps.map((step) => {
        const locked = Boolean(step.requiresFirstSuccess) && !open;
        if (locked) {
          return (
            <li key={step.n}>
              <span
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/45"
                aria-disabled="true"
                title="练完一轮再来"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-medium text-muted-foreground/50"
                  aria-hidden
                >
                  {step.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-normal">
                    {step.n} · {step.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/55">
                    练完一轮再来
                  </span>
                </span>
              </span>
            </li>
          );
        }
        return (
          <li key={step.n}>
            <Link
              href={step.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-medium text-muted-foreground/80"
                aria-hidden
              >
                {step.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-normal">
                  {step.n} · {step.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                  {step.requiresFirstSuccess && open && step.title === "市集"
                    ? "意思练过一轮，可以来市集试试。"
                    : step.hint}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
