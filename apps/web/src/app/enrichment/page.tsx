import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnrichmentQueue, getFloorSummary } from "@/lib/content";

export const metadata: Metadata = {
  title: "审校",
};

export default function EnrichmentPage() {
  const floor = getFloorSummary();
  const queue = getEnrichmentQueue();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          审校
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">待补中文义</h1>
        <p className="mt-3 text-muted-foreground">
          下面这些词还缺中文义，留给人手。词条在{" "}
          <Link className="underline" href="/lexemes">
            词库
          </Link>
          。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>还缺中文义</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {floor.counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>可以练</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {floor.counts.ready}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>本页条数</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {queue?.items?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>还缺合计</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {queue?.pending_total ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <details className="rounded-xl border border-border bg-card/80 open:bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          搭建者：如何合并一批审校稿
        </summary>
        <div className="space-y-2 border-t border-border px-4 py-3 font-mono text-sm text-muted-foreground">
          <p>缺字段的行会被 merge 拒绝。详见 docs/enrichment-pipeline.md。</p>
          <p>1. npm run enrichment:queue</p>
          <p>2. 编辑 content/lexemes/enrichment-queue.json（填 gloss_zh / phonetic_text / example；status=reviewed）</p>
          <p>3. npm run enrichment:merge -- --from content/lexemes/enrichment-queue.json</p>
          <p>4. npm run enrichment:validate && npm run check</p>
        </div>
      </details>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">待审</Badge>
            {queue?.generated_at ? (
              <Badge variant="outline">{queue.generated_at}</Badge>
            ) : (
              <Badge variant="outline">尚未生成队列</Badge>
            )}
          </div>
          <CardTitle>待补清单</CardTitle>
          <CardDescription>没有中文义的才进队。</CardDescription>
        </CardHeader>
        <CardContent>
          {!queue?.items?.length ? (
            <p className="text-muted-foreground">队列还是空的。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.items.map((item) => (
                <li
                  key={item.lemma_id}
                  className="flex flex-col gap-1 border-b border-border/70 pb-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span>
                    <span className="font-medium">{item.lemma}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      rank {item.freq_rank ?? "—"} · {item.status}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    英义参考：{item.gloss_en || "（无）"} · 中文义：{item.gloss_zh || "空"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
