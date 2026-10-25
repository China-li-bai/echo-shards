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
          营地 · 学徒日课
        </p>
        <h1 className="font-display mt-3 text-5xl leading-tight text-balance sm:text-6xl">
          言灵残片
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">Echo Shards</p>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed">
          今天只练「想得起来」：先认词、拼词，再去市集把关键信息问出来。一步一步走完今日轨道就好。
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
                  形界优先
                </span>
              </div>
              <CardTitle className="font-display text-3xl text-balance">
                日课 → 接受 → 潮汐 → 交易所
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-relaxed">
                先接今日提案，再练一轮拼写，最后去市集把价格和时间问出来。
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/day"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                开始今日：去日课
              </Link>
              <Link
                href="/quests"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
              >
                已练过？去市集问价
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">1 · 日课</span>
                <span className="mt-0.5 block">一键接受今日提案</span>
              </li>
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">2 · 潮汐</span>
                <span className="mt-0.5 block">约 5 词 · 拼写一轮</span>
              </li>
              <li className="rounded-md bg-secondary/70 px-3 py-2">
                <span className="font-medium text-foreground">3 · 交易所</span>
                <span className="mt-0.5 block">用英文把关键信息问出来</span>
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
              <Badge variant="secondary">今日</Badge>
              <CardTitle className="font-display text-2xl">日课</CardTitle>
              <CardDescription>接过今日提案，再进潮汐。进阶选项可改意图与词表。</CardDescription>
            </CardHeader>
            <CardContent>开始今天的闭环</CardContent>
          </Card>
        </Link>
        <Link href="/review" className="group">
          <Card className="realm-form h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="secondary">形界</Badge>
              <CardTitle className="font-display text-2xl">潮汐</CardTitle>
              <CardDescription>约 5 词拼写。对照后看进度与下次潮汐时间。</CardDescription>
            </CardHeader>
            <CardContent>进入复习</CardContent>
          </Card>
        </Link>
        <Link href="/quests" className="group">
          <Card className="h-full transition-colors group-hover:bg-secondary/60">
            <CardHeader>
              <Badge variant="outline">市集</Badge>
              <CardTitle className="font-display text-2xl">{quest.title}</CardTitle>
              <CardDescription>{quest.goal}</CardDescription>
            </CardHeader>
            <CardContent>打开信息差摊位</CardContent>
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

      <section className="rounded-xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="max-w-2xl text-base leading-relaxed">
          先想得起来，再问得出来。工坊里的词库与审校留给搭建者；你在营地把今日轨道走完即可。
        </p>
      </section>
    </div>
  );
}
