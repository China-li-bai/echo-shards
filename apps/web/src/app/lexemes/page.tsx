import type { Metadata } from "next";
import { LexemeBrowser } from "@/components/lexeme-browser";
import { getFloorSummary, getLexemeRows } from "@/lib/content";

export const metadata: Metadata = {
  title: "词库地板",
};

export default function LexemesPage() {
  const rows = getLexemeRows();
  const { meta, counts } = getFloorSummary();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {meta.pack.id}
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">口语地板，不是假词表</h1>
        <p className="mt-3 text-muted-foreground">
          {counts.lemmas} 个 lemma 来自 {meta.pack.citation ?? meta.pack.license}。
          已就绪 {counts.ready}，部分 {counts.partial}，待审校 {counts.pending}。中文义只显示审校过的行。
        </p>
      </div>
      <LexemeBrowser rows={rows} />
    </div>
  );
}
