import type { Metadata } from "next";
import { LexemeBrowser } from "@/components/lexeme-browser";
import { getFloorSummary, getLexemeRows } from "@/lib/content";

export const metadata: Metadata = {
  title: "词库",
};

export default function LexemesPage() {
  const rows = getLexemeRows();
  const { counts } = getFloorSummary();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          词库
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">口语地板</h1>
        <p className="mt-3 text-muted-foreground">
          {counts.lemmas} 词；已就绪 {counts.ready}，待审校 {counts.pending}。
        </p>
      </div>
      <LexemeBrowser rows={rows} />
    </div>
  );
}
