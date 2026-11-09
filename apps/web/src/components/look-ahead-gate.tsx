"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Honest PR5 placeholder before PR6 recognition half-beat.
 * Honest interim CTA; the post-look close line belongs to PR6 only.
 */
export function LookAheadGate() {
  const search = useSearchParams();
  const params = new URLSearchParams();
  for (const key of ["aspect", "from", "variant", "ids", "quest"] as const) {
    const value = search.get(key);
    if (value) params.set(key, value);
  }
  if (!params.has("aspect")) params.set("aspect", "meaning");
  if (!params.has("from")) params.set("from", "day");
  const reviewHref = `/review?${params.toString()}`;

  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary">下一屏</Badge>
        <CardTitle className="font-display text-2xl">先看一眼</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          完整「先看一眼」还在路上：到时候会先给你看词和意思，再让你试着写。
          现在可以先进入意思练习；完整半拍做好前，这里不假装半拍已经走完。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <Button type="button" size="lg" render={<Link href={reviewHref} />}>
          进入意思练习
        </Button>
        <Link
          href="/day"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          回日课
        </Link>
      </CardContent>
    </Card>
  );
}
