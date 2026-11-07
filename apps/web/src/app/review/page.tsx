import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewPageShell } from "@/components/review-page-shell";
import { ReviewSession } from "@/components/review-session";
import { getReviewPools } from "@/lib/content";
import type { Aspect } from "@echo-shards/core";

/** Static fallback; client shell sets document.title from local traces (PR5). */
export const metadata: Metadata = {
  title: "今天练意思",
};

function parseAspect(raw: string | string[] | undefined): Aspect {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "meaning" || value === "phonology_text" || value === "form") return value;
  // 解锁链默认义→形：裸 /review 先义界，避免绕过闸门直进形界。
  return "meaning";
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
  const phonologyPools = getReviewPools("phonology_text");
  const pools =
    aspect === "meaning"
      ? meaningPools
      : aspect === "phonology_text"
        ? phonologyPools
        : [...formPools, ...meaningPools, ...phonologyPools];

  return (
    <ReviewPageShell aspect={aspect}>
      <Suspense fallback={<p className="text-muted-foreground">正在准备…</p>}>
        <ReviewSession pools={pools} />
      </Suspense>
    </ReviewPageShell>
  );
}
