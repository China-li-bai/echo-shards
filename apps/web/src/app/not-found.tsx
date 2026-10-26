import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl">没有这一页</h1>
      <p className="text-muted-foreground">营地、形界、词库、市集，四条路都在顶栏。</p>
      <Link href="/" className="text-primary underline-offset-4 hover:underline">
        回营地
      </Link>
    </div>
  );
}
