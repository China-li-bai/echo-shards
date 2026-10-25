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
  return "form";
}

const HEADLINE: Record<Aspect, string> = {
  form: "拼出来，再看下次潮汐",
  meaning: "写出中文义，再看下次潮汐",
  phonology_text: "写出文字音标，再看下次潮汐",
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          潮汐 · {ASPECT_LABEL[aspect]}
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">{HEADLINE[aspect]}</h1>
        <p className="mt-3 text-muted-foreground">
          一轮只练一个面向。对照后确认等级，进度与下次潮汐时间会显示出来（只读）。
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">加载复习…</p>}>
        <ReviewSession pools={pools} />
      </Suspense>
    </div>
  );
}
