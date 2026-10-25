import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCampProgress, getFloorSummary, getQuest } from "@/lib/content";

export default function HomePage() {
  const floor = getFloorSummary();
  const quest = getQuest();
  const progress = getCampProgress();
  const { counts, meta } = floor;
  const stats = [
    { label: "口语地板 lemmas", value: counts.lemmas, note: "NGSL-Spoken 1.2" },
    { label: "义项已就绪", value: counts.ready, note: "含音标、中文义、例句" },
    { label: "待审校", value: counts.pending, note: "不编造 gloss" },
    { label: "词形变体", value: counts.forms, note: "屈折 / 拼写" },
  ];
  const camp = [
    { label: "连续天数", value: progress.streak_days, note: "Asia/Shanghai · 事件推导" },
    { label: "会话", value: progress.session_count, note: "session_end 事件" },
    { label: "XP", value: progress.xp, note: "retrieval + quest" },
    { label: "残片 shards", value: progress.shards, note: "001 progress 字段" },
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
          这一轮只练「想得起来」。形 / 义 / 音文字分轨，评分进 TideScheduler，下次到期由
          ts-fsrs 决定。会说，留给交易所的信息差：学生必须自己把关键信息问出来。
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">营地进度</Badge>
          <span className="text-sm text-muted-foreground">
            营地等级 {progress.camp_level} · 来自 learning_events / eval（.data 或占位 0）
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {camp.map((stat) => (
            <Card key={stat.label} size="sm">
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="font-display text-3xl tabular-nums">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{stat.note}</CardContent>
            </Card>
          ))}
        </div>
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

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/day" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">Director</Badge>
              <CardTitle className="font-display text-2xl">日课提案</CardTitle>
              <CardDescription>意图 → 2–3 提案 → 明确接受。含音界·文字变体。</CardDescription>
            </CardHeader>
            <CardContent>开始今天的闭环</CardContent>
          </Card>
        </Link>
        <Link href="/review" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">TOPRA · form</Badge>
              <CardTitle className="font-display text-2xl">潮汐复习</CardTitle>
              <CardDescription>约 5 词，一轮一个 aspect。看每张卡的下次 due。</CardDescription>
            </CardHeader>
            <CardContent>进入复习</CardContent>
          </Card>
        </Link>
        <Link href="/review?aspect=phonology_text" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">TOPRA · phonology_text</Badge>
              <CardTitle className="font-display text-2xl">音界·文字</CardTitle>
              <CardDescription>看英文词写 IPA。无 ASR / TTS；不评分音频。</CardDescription>
            </CardHeader>
            <CardContent>进入音界文字轮</CardContent>
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
        <Link href="/eval" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="outline">Eval Sentinel</Badge>
              <CardTitle className="font-display text-2xl">营地评估</CardTitle>
              <CardDescription>金标守卫、deal rate、短 episode 记忆。</CardDescription>
            </CardHeader>
            <CardContent>查看摘要</CardContent>
          </Card>
        </Link>
        <Link href="/review?aspect=meaning" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">TOPRA · meaning</Badge>
              <CardTitle className="font-display text-2xl">义界潮汐</CardTitle>
              <CardDescription>看英文词写中文义。待审校词不会被编造 gloss。</CardDescription>
            </CardHeader>
            <CardContent>进入义界</CardContent>
          </Card>
        </Link>
        <Link href="/enrichment" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="outline">审校队列</Badge>
              <CardTitle className="font-display text-2xl">Enrichment</CardTitle>
              <CardDescription>只读队列 + 合并步骤。不发明 671 条假释义。</CardDescription>
            </CardHeader>
            <CardContent>打开管线说明</CardContent>
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
