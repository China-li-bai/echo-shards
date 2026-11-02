import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewSession } from "@/components/review-session";
import { getReviewPools } from "@/lib/content";
import { ASPECT_LABEL, type Aspect } from "@echo-shards/core";

export const metadata: Metadata = {
  title: "潮汐复习",
};

function parseAspect(raw: string | string[] | undefined): Aspect {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "meaning" || value === "phonology_text" || value === "form") return value;
  // 解锁链默认义→形：裸 /review 先义界，避免绕过闸门直进形界。
  return "meaning";
}

const RITUAL_LINE: Record<Aspect, string> = {
  form: "这一轮 · 只练拼写",
  meaning: "这一轮 · 只练意思",
  phonology_text: "这一轮 · 只练读音",
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const aspect = parseAspect(params.aspect);
  const formPools = getReviewPools("form");
  const meaningPools = getReviewPools("meaning");
  const phonologyPools = getReviewPools("phonology_text");
  const pools =
    aspect === "meaning"
      ? meaningPools
      : aspect === "phonology_text"
        ? phonologyPools
        : [...formPools, ...meaningPools, ...phonologyPools];

  return (
    <div className="tide-beach mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          潮汐 · {ASPECT_LABEL[aspect]}
        </p>
        <h1 className="font-display mt-2 text-2xl text-balance sm:text-3xl">
          {RITUAL_LINE[aspect]}
        </h1>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">加载复习…</p>}>
        <ReviewSession pools={pools} />
      </Suspense>
    </div>
  );
}
