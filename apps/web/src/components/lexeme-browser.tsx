"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LexemeRow } from "@/lib/content";

type Filter = "all" | "ready" | "pending" | "partial";

const PAGE_SIZE = 40;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ready", label: "已就绪" },
  { id: "partial", label: "部分" },
  { id: "pending", label: "待审校" },
];

export function LexemeBrowser({ rows }: { rows: LexemeRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      ready: rows.filter((row) => row.enrichment_status === "ready").length,
      partial: rows.filter((row) => row.enrichment_status === "partial").length,
      pending: rows.filter((row) => row.enrichment_status === "pending").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.enrichment_status !== filter) return false;
      if (!needle) return true;
      return (
        row.lemma.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle) ||
        row.gloss_zh.includes(query.trim()) ||
        (row.gloss_en ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, query, filter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="lemma-search">
          搜索 lemma
        </label>
        <Input
          id="lemma-search"
          value={query}
          placeholder="搜 lemma、中文义或上游英义"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          className="h-11! sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => {
                setFilter(item.id);
                setPage(0);
              }}
            >
              {item.label} {counts[item.id]}
            </Button>
          ))}
        </div>
      </div>

      {filter === "pending" ? (
        <p className="text-sm text-muted-foreground">
          这些 lemma 还没有中文义、音标或例句。
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
          没有 lemma 对得上。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <li key={row.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="w-10 text-sm text-muted-foreground tabular-nums">
                    {row.freq_rank ?? "—"}
                  </span>
                  <span className="font-display text-xl">{row.lemma}</span>
                  {row.phonetic_text ? (
                    <span className="text-sm text-muted-foreground">{row.phonetic_text}</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {row.cefr ? <Badge variant="outline">{row.cefr}</Badge> : null}
                  <Badge variant={row.enrichment_status === "ready" ? "secondary" : "outline"}>
                    {statusLabel(row.enrichment_status)}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 pl-12 text-sm">
                {row.gloss_zh.trim() ? row.gloss_zh : <span className="text-muted-foreground">待审校</span>}
              </p>
              {row.gloss_en ? (
                <p className="mt-1 pl-12 text-sm text-muted-foreground">上游英义 · {row.gloss_en}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length} 条 · 第 {safePage + 1}/{pages} 页
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            上一页
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: LexemeRow["enrichment_status"]): string {
  if (status === "ready") return "已就绪";
  if (status === "partial") return "部分";
  if (status === "blocked") return "阻塞";
  return "待审校";
}
