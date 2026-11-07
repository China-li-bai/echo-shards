import type { Metadata } from "next";
import { Suspense } from "react";
import { LookAheadGate } from "@/components/look-ahead-gate";

export const metadata: Metadata = {
  title: "先看一眼",
};

/**
 * PR5 skeleton for lesson-first「先看一眼」(内部：认识半拍).
 * Full word+gloss+example walkthrough is PR6 — this page must not claim
 * the learner has already looked.
 */
export default function LookPage() {
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
        <LookAheadGate />
      </Suspense>
    </div>
  );
}
