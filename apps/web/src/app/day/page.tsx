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
          Curriculum Director
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">日课 · 意图 → 提案 → 接受</h1>
        <p className="mt-3 text-muted-foreground">
          模型（这里是确定性 Director）只提案。你点接受之后，才打开 Tide Steward 批次。Quest
          组合提案不会给卡打分。
        </p>
      </div>
      <DayDesk options={options} />
    </div>
  );
}
