import { ClearPracticeRecords } from "@/components/clear-practice-records";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 text-xs text-muted-foreground/80 sm:px-6">
        {/* PR4: 出处进折叠，不抢学徒主路径扫视 */}
        <details className="group max-w-xl">
          <summary className="cursor-pointer list-none hover:text-muted-foreground [&::-webkit-details-marker]:hidden">
            关于词表
          </summary>
          <div className="mt-2 space-y-1 leading-relaxed text-muted-foreground">
            <p>
              口语常用词表来自 NGSL-Spoken 1.2 © Charles Browne & Brent Culligan，CC BY-SA
              4.0。
            </p>
            <p>中文义来自人工审校；未审的不显示。</p>
          </div>
        </details>
        {/* PR8: 演示卫生 — 可发现、非主 CTA；须确认后才清本机练习痕迹 */}
        <details className="group max-w-xl">
          <summary className="cursor-pointer list-none hover:text-muted-foreground [&::-webkit-details-marker]:hidden">
            演示
          </summary>
          <div className="mt-2">
            <ClearPracticeRecords />
          </div>
        </details>
      </div>
    </footer>
  );
}
