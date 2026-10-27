import Link from "next/link";
import { CampLedger } from "@/components/camp-ledger";
import { FormShardWall } from "@/components/form-shard-wall";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDayLexemeOptions,
  getFloorSummary,
  getLexemeRows,
  getQuest,
  listQuests,
} from "@/lib/content";

export default function HomePage() {
  const floor = getFloorSummary();
  const quest = getQuest();
  const { counts, meta } = floor;
  const labels: Record<string, string> = {};
  for (const row of getLexemeRows()) {
    labels[row.id] = row.lemma;
  }
  for (const row of getDayLexemeOptions()) {
    labels[row.id] = row.orthography;
  }
  const questTargetsById: Record<string, string[]> = {};
  for (const q of listQuests()) {
    questTargetsById[q.id] = [...q.target_lexemes];
  }

  const steps = [
    { n: "1", href: "/day", title: "日课", hint: "接受今日提案", icon: "日" },
    { n: "2", href: "/review?aspect=meaning", title: "潮汐", hint: "约 5 词写义", icon: "潮" },
    {
      n: "3",
      href: "/quests",
      title: "市集",
      hint: quest.title,
      icon: "市",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="max-w-3xl">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          营地
        </p>
        <h1 className="font-display mt-3 text-5xl leading-tight text-balance sm:text-6xl">
          言灵残片
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">Echo Shards</p>
      </section>

      {/* 今日轨道：唯一主路径；枢纽收成卡内小步骤 */}
      <section>
        <Card className="realm-form overflow-hidden border-primary/25 bg-card/90">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="realm-badge">今日轨道</Badge>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="realm-dot" aria-hidden />
                  义界优先
                </span>
              </div>
              <CardTitle className="font-display text-3xl text-balance">
                日课 → 潮汐 → 市集
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-relaxed">
                先接今日提案，再练一轮写义，最后去市集把价格和时间问出来。
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/day"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                去日课
              </Link>
              <Link
                href="/quests"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-muted"
              >
                去市集问价
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.n}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-2.5 rounded-md bg-secondary/70 px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
                      aria-hidden
                    >
                      {step.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">
                        {step.n} · {step.title}
                      </span>
                      <span className="mt-0.5 block truncate text-muted-foreground">
                        {step.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* 形界残片墙：轨道下；非导航项 */}
      <section aria-label="形界残片墙">
        <FormShardWall labels={labels} questTargetsById={questTargetsById} />
      </section>

      {/* 营地账本：一行折叠；旁注替代大横幅 */}
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
    </div>
  );
}
