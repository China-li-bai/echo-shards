import type { Metadata } from "next";
import { DayDesk } from "@/components/day-desk";
import { getDayLexemeOptions } from "@/lib/content";

export const metadata: Metadata = {
  title: "日课提案",
};

export default function DayPage() {
  const options = getDayLexemeOptions();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          日课
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">今日提案</h1>
        <p className="mt-3 text-muted-foreground">
          一键接过，再进潮汐。需要时再改意图与词表。
        </p>
      </div>
      <DayDesk options={options} />
    </div>
  );
}
