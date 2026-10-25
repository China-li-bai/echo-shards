"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl">这一页没有读出来</h1>
      <p className="max-w-xl text-muted-foreground">{error.message}</p>
      <div>
        <Button type="button" onClick={() => reset()}>
          再试一次
        </Button>
      </div>
    </div>
  );
}
