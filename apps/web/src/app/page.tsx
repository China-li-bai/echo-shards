import Link from "next/link";
import { CampLedger } from "@/components/camp-ledger";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFloorSummary, getQuest } from "@/lib/content";

export default function HomePage() {
  const floor = getFloorSummary();
  const quest = getQuest();
  const { counts, meta } = floor;

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

      {/* 今日轨道：唯一主路径 */}
      <section>
        <Card className="realm-form overflow-hidden border-primary/25 bg-card/90">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="realm-badge">今日轨道</Badge>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="realm-dot" aria-hidden />
                  形界 · due 只读
                </span>
              </div>
              <CardTitle className="font-display text-3xl text-balance">
                日课提案 → 接受 → 潮汐
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-relaxed">
                Curriculum Director 只提案；你点接受后才开 Tide Steward。LLM 不改 due，语音 /
                公网继续延后。
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/day"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                继续今日：去日课
              </Link>
              <Link
                href="/quests"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
              >
                顺路去市集问价
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">1 · 日课</span>
                <span className="mt-0.5 block">意图 → 2–3 提案 → 接受</span>
              </li>
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">2 · 潮汐</span>
                <span className="mt-0.5 block">约 5 词 · 一轮一个 aspect</span>
              </li>
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">3 · 交易所</span>
                <span className="mt-0.5 block">信息差 · must_elicit</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* 三枢纽 */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/day" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">Director</Badge>
              <CardTitle className="font-display text-2xl">日课</CardTitle>
              <CardDescription>意图 → 2–3 提案 → 明确接受。含音界·文字变体。</CardDescription>
            </CardHeader>
            <CardContent>开始今天的闭环</CardContent>
          </Card>
        </Link>
        <Link href="/review" className="group">
          <Card className="realm-form h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">TOPRA · form</Badge>
              <CardTitle className="font-display text-2xl">潮汐</CardTitle>
              <CardDescription>约 5 词，一轮一个 aspect。看每张卡的下次 due（只读）。</CardDescription>
            </CardHeader>
            <CardContent>进入复习</CardContent>
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

      {/* 营地账本：本机事件推导（非 Workers 服务端账本） */}
      <section>
        <CampLedger
          floor={{
            ready: counts.ready,
            lemmas: counts.lemmas,
            partial: counts.partial,
            pending: counts.pending,
            forms: counts.forms,
            license: meta.pack.license,
            coverageNote: meta.pack.coverage_note ?? "NGSL-Spoken 口语覆盖",
          }}
        />
      </section>

      <section className="grid gap-3 rounded-xl bg-primary px-5 py-5 text-primary-foreground sm:grid-cols-3">
        <p>一轮只锁一个 aspect。形、义、音文字各有一张 FSRS 卡。</p>
        <p>LLM 不写 due。等级 1–4 只通过 TideScheduler.rate。</p>
        <p>SRS 卡和 Quest 跑次分表。成交看 must_elicit，不看聊得顺不顺。</p>
      </section>
    </div>
  );
}
