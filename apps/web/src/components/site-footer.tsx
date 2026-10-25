export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p>
          NGSL-Spoken 1.2 © Charles Browne & Brent Culligan，CC BY-SA 4.0。词表在{" "}
          <span className="text-foreground">content/packs/ngsl-s-1.2/</span>，NOTICE 与 CITATION 保留在包内。
        </p>
        <p>应用代码 UNLICENSED。义项 enrichment 大多仍待审校，本应用不会编造中文释义。</p>
      </div>
    </footer>
  );
}
