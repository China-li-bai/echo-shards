"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

/** Learner shell — always visible */
const PRIMARY = [
  { href: "/", label: "营地" },
  { href: "/day", label: "日课" },
  { href: "/review", label: "潮汐" },
  { href: "/quests", label: "市集" },
];

/** Builder / ops shell — secondary */
const WORKSHOP = [
  { href: "/lexemes", label: "词库" },
  { href: "/enrichment", label: "审校" },
  { href: "/eval", label: "评估" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const workshopActive = WORKSHOP.some((link) => isActive(pathname, link.href));

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
              <path
                d="M4 22c4.5-8 8-8 11-1.5C18 27 21.5 27 28 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="24" cy="9" r="2.2" fill="currentColor" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="font-display block text-base font-medium">言灵残片</span>
            <span className="block text-xs tracking-wide text-muted-foreground">Echo Shards</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 text-sm" aria-label="主壳">
            {PRIMARY.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    active &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <details className="relative">
            <summary
              className={cn(
                "cursor-pointer list-none rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden",
                workshopActive && "bg-secondary text-secondary-foreground",
              )}
            >
              工坊
            </summary>
            <div className="absolute right-0 mt-1 min-w-[8.5rem] rounded-lg border border-border bg-card p-1 shadow-md">
              {WORKSHOP.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                      active && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
