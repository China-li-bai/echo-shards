import type { Metadata } from "next";
import { ReviewSession } from "@/components/review-session";
import { getReviewPools } from "@/lib/content";

export const metadata: Metadata = {
  title: "形界潮汐",
};

export default function ReviewPage() {
  const pools = getReviewPools();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Form aspect</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">拼出来，再看下次潮汐</h1>
        <p className="mt-3 text-muted-foreground">
          提示只有中文义和挖空例句。对照发生在服务端的 Forge Smith；你点下的等级才交给 TideScheduler。
        </p>
      </div>
      <ReviewSession pools={pools} />
    </div>
  );
}
