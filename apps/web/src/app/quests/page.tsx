import type { Metadata } from "next";
import { QuestDesk } from "@/components/quest-desk";
import { getQuest } from "@/lib/content";

export const metadata: Metadata = {
  title: "回声交易所",
};

export default function QuestPage() {
  const quest = getQuest();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Echo Bazaar · stub
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">{quest.title}</h1>
        <p className="mt-3 text-muted-foreground">{quest.goal}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          来自 content/quests/{quest.id}.yaml。Quest 跑次和 SRS 卡不是同一张表。
        </p>
      </div>
      <QuestDesk quest={quest} />
    </div>
  );
}
