import type { Metadata } from "next";
import { Suspense } from "react";
import { LookAheadGate } from "@/components/look-ahead-gate";
import { getLookCards } from "@/lib/content";

export const metadata: Metadata = {
  title: "先看一眼",
};

/**
 * PR6 recognition half-beat (学徒名「先看一眼」；内部：认识半拍).
 * Walk word + gloss + optional example before meaning recall.
 */
export default function LookPage() {
  // Broad pool; client filters by ?ids= or today's day-plan.
  const cards = getLookCards();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          日课
        </p>
        <h1 className="font-display mt-2 text-2xl text-balance sm:text-3xl">
          先看一眼
        </h1>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">正在准备…</p>}>
        <LookAheadGate cards={cards} />
      </Suspense>
    </div>
  );
}
