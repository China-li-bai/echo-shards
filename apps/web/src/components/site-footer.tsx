export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p>口语常用词表来自 NGSL-Spoken 1.2 © Charles Browne & Brent Culligan，CC BY-SA 4.0。</p>
        <p>中文义来自人工审校；未审的不显示。</p>
      </div>
    </footer>
  );
}
