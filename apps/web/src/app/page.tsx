import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFloorSummary, getQuest } from "@/lib/content";

export default function HomePage() {
  const floor = getFloorSummary();
  const quest = getQuest();
  const { counts, meta } = floor;
  const stats = [
    { label: "口语地板 lemmas", value: counts.lemmas, note: "NGSL-Spoken 1.2" },
    { label: "义项已就绪", value: counts.ready, note: "含音标、中文义、例句" },
    { label: "待审校", value: counts.pending, note: "不编造 gloss" },
    { label: "词形变体", value: counts.forms, note: "屈折 / 拼写" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="max-w-3xl">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Text first · no ASR
        </p>
        <h1 className="font-display mt-3 text-5xl leading-tight text-balance sm:text-6xl">
          言灵残片
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">Echo Shards</p>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed">
          这一轮只练「想得起来」。形界五词，评分进 TideScheduler，下次到期由 ts-fsrs 决定。
          会说，留给交易所的信息差：学生必须自己把价格、还价和打烊时间问出来。
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-display text-3xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{stat.note}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/review" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">TOPRA · form</Badge>
              <CardTitle className="font-display text-2xl">形界潮汐</CardTitle>
              <CardDescription>约 5 词，只开拼写。看每张卡的下次 due。</CardDescription>
            </CardHeader>
            <CardContent>进入复习</CardContent>
          </Card>
        </Link>
        <Link href="/lexemes" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="outline">{meta.pack.license}</Badge>
              <CardTitle className="font-display text-2xl">词库地板</CardTitle>
              <CardDescription>
                {meta.pack.coverage_note ?? "NGSL-Spoken 口语覆盖"}
              </CardDescription>
            </CardHeader>
            <CardContent>浏览 {counts.lemmas} 个 lemma</CardContent>
          </Card>
        </Link>
        <Link href="/quests" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="outline">Quest · text</Badge>
              <CardTitle className="font-display text-2xl">{quest.title}</CardTitle>
              <CardDescription>{quest.goal}</CardDescription>
            </CardHeader>
            <CardContent>打开信息差桩</CardContent>
          </Card>
        </Link>
      </section>

      <section className="grid gap-3 rounded-xl bg-primary px-5 py-5 text-primary-foreground sm:grid-cols-3">
        <p>一轮只锁一个 aspect。形、义、音文字各有一张 FSRS 卡。</p>
        <p>LLM 不写 due。等级 1–4 只通过 TideScheduler.rate。</p>
        <p>SRS 卡和 Quest 跑次分表。成交看 must_elicit，不看聊得顺不顺。</p>
      </section>
    </div>
  );
}
