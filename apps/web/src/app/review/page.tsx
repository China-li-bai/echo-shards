import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewSession } from "@/components/review-session";
import { getReviewPools } from "@/lib/content";
import type { Aspect } from "@echo-shards/core";

export const metadata: Metadata = {
  title: "潮汐复习",
};

function parseAspect(raw: string | string[] | undefined): Aspect {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "meaning" || value === "phonology_text" || value === "form") return value;
  return "form";
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const aspect = parseAspect(params.aspect);
  const formPools = getReviewPools("form");
  const meaningPools = getReviewPools("meaning");
  const pools = aspect === "meaning" ? meaningPools : [...formPools, ...meaningPools];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Tide Steward · Forge Smith
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">
          {aspect === "meaning" ? "写出中文义，再看下次潮汐" : "拼出来，再看下次潮汐"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          形界与义界分轨。Forge Smith 只建议等级；你确认后 Tide Steward 才调用
          TideScheduler.rate。支持从 /day 接受提案后打开对应批次。
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">加载复习…</p>}>
        <ReviewSession pools={pools} />
      </Suspense>
    </div>
  );
}
