"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * 어드민 사이드바 — Spotify 네비 영감.
 *
 * Active: white text + 굵게 (font-bold), 좌측에 Spotify Green 인디케이터
 * Inactive: silver text (--color-muted-foreground), hover시 surface bg
 */

type NavItem = {
  label: string;
  href?: string;
  disabled?: boolean;
};

const ITEMS: NavItem[] = [
  { label: "라이브", href: "/admin/lives" },
  { label: "시리즈", href: "/admin/series" },
  { label: "작품", href: "/admin/works" },
  { label: "투어", href: "/admin/tours" },
  { label: "밴드", href: "/admin/bands" },
  { label: "판매처", href: "/admin/vendors" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 bg-[color:var(--color-background)] p-3 lg:block">
      <nav aria-label="어드민 메뉴" className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="cursor-not-allowed px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] opacity-60"
                aria-disabled
              >
                {item.label}
                <span className="ml-2 text-[10px] uppercase tracking-[var(--tracking-button)]">
                  곧
                </span>
              </span>
            );
          }

          const active = pathname?.startsWith(item.href ?? "");

          return (
            <Link
              key={item.label}
              href={item.href ?? "#"}
              className={cn(
                "relative rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
                active
                  ? "font-bold text-[color:var(--color-foreground)] bg-[color:var(--color-muted)]"
                  : "font-medium text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--color-primary)]"
                />
              ) : null}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
