import type { Metadata } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { findRepoRoot } from "@echo-shards/core/node";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFloorSummary } from "@/lib/content";

export const metadata: Metadata = {
  title: "Enrichment 审校",
};

interface QueueFile {
  generated_at?: string;
  pending_total?: number;
  limit?: number;
  policy?: string;
  items?: Array<{
    lemma: string;
    lemma_id: string;
    freq_rank: number | null;
    gloss_en: string | null;
    gloss_zh: string;
    status: string;
  }>;
}

export default function EnrichmentPage() {
  const floor = getFloorSummary();
  const root = findRepoRoot();
  const queuePath = join(root, "content/lexemes/enrichment-queue.json");
  const queue: QueueFile | null = existsSync(queuePath)
    ? (JSON.parse(readFileSync(queuePath, "utf8")) as QueueFile)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Enrichment · human review
        </p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">审校队列（只读）</h1>
        <p className="mt-3 text-muted-foreground">
          展示下一批评审 lemma 与上游英义。空 gloss_zh 留给人工；合并步骤见{" "}
          <Link className="underline" href="/lexemes">
            词库
          </Link>{" "}
          与 docs/enrichment-pipeline.md。禁止编造中文义。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>pending</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {floor.counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>ready</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {floor.counts.ready}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>队列条数</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {queue?.items?.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>pending_total</CardDescription>
            <CardTitle className="font-display text-3xl tabular-nums">
              {queue?.pending_total ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>如何合并一批审校稿</CardTitle>
          <CardDescription>不经过模型填义；缺字段的行会被 merge 拒绝。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <p>1. npm run enrichment:queue</p>
          <p>2. 编辑 content/lexemes/enrichment-queue.json（填 gloss_zh / phonetic_text / example；status=reviewed）</p>
          <p>3. npm run enrichment:merge -- --from content/lexemes/enrichment-queue.json</p>
          <p>4. npm run enrichment:validate && npm run check</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">needs_review</Badge>
            {queue?.generated_at ? (
              <Badge variant="outline">{queue.generated_at}</Badge>
            ) : (
              <Badge variant="outline">尚未生成队列 · 先跑 enrichment:queue</Badge>
            )}
          </div>
          <CardTitle>下一批评审</CardTitle>
          <CardDescription>{queue?.policy ?? "empty gloss_zh only"}</CardDescription>
        </CardHeader>
        <CardContent>
          {!queue?.items?.length ? (
            <p className="text-muted-foreground">队列为空。运行 npm run enrichment:queue。</p>
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
                    上游英义：{item.gloss_en || "（无）"} · gloss_zh「{item.gloss_zh || "空"}」
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
