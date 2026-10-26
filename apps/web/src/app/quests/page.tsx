import type { Metadata } from "next";
import { QuestDesk } from "@/components/quest-desk";
import { getQuest, listQuests } from "@/lib/content";

export const metadata: Metadata = {
  title: "回声交易所",
};

export default async function QuestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const quest = getQuest(id);
  const catalog = listQuests();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          交易所
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">{quest.title}</h1>
        <p className="mt-3 text-muted-foreground">{quest.goal}</p>
      </div>
      <QuestDesk quest={quest} catalog={catalog} />
    </div>
  );
}
