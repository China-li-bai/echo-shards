"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readTodayPracticeHref } from "@/lib/today-practice-href";

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
      <p className="max-w-[16rem] text-sm text-muted-foreground sm:text-right">
        先认识几个词，再试着记起来。
      </p>
      <Link
        href="/quests"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        去市集问价
      </Link>
    </div>
  );
}
