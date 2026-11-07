"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hasFirstMeaningSuccess } from "@/lib/learner-practice-local";
import { readTodayPracticeHref } from "@/lib/today-practice-href";

/** Camp primary CTA: one solid button; bazaar gated until first meaning success (PR7). */
export function CampPracticeCta() {
  const [href, setHref] = useState("/day");
  /** null = hydration pending; default locked (cold-start safe). */
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    setHref(readTodayPracticeHref());
    setUnlocked(hasFirstMeaningSuccess());
  }, []);

  const bazaarOpen = unlocked === true;

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        开始今天的练习
      </Link>
      <p className="max-w-[16rem] text-sm text-muted-foreground sm:text-right">
        先认识几个词，再试着记起来。
      </p>
      {bazaarOpen ? (
        <>
          <Link
            href="/quests"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            去市集问价
          </Link>
          <p className="max-w-[16rem] text-xs text-muted-foreground/80 sm:text-right">
            意思练过一轮，可以来市集试试。
          </p>
        </>
      ) : (
        <p
          className="max-w-[16rem] text-xs text-muted-foreground/60 sm:text-right"
          title="练完一轮再来"
        >
          市集 · 练完一轮再来
        </p>
      )}
    </div>
  );
}
