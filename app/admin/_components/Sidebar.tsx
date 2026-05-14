import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * 어드민 사이드바.
 *
 * 메뉴 5종 — 본 사이클은 라이브만 활성, 나머지(시리즈/작품/밴드/판매처) 는
 * 다음 사이클에서 추가. 비활성 항목은 회색으로 표시.
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
  { label: "밴드", href: "/admin/bands" },
  { label: "판매처", href: "/admin/vendors" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[color:var(--color-border)] bg-[color:var(--color-muted)]/40 p-4 lg:block">
      <nav aria-label="어드민 메뉴" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="cursor-not-allowed rounded-[var(--radius-md)] px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] opacity-60"
                aria-disabled
              >
                {item.label}
                <span className="ml-2 text-[10px] uppercase tracking-wide">
                  곧
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href ?? "#"}
              className={cn(
                "rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
