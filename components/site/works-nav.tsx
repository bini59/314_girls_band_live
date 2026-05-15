import Link from "next/link";

import type { NavWork } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

/**
 * 작품(Work) 데스크탑 메뉴 — Spotify pill 네비.
 * hover/focus-within 시 하위 밴드 드롭다운.
 *
 * 모바일은 `<MobileMenu />` 가 별도로 담당.
 */
export function WorksNav({ works }: { works: NavWork[] }) {
  if (works.length === 0) return null;

  return (
    <nav aria-label="작품" className="flex items-stretch gap-1">
      {works.map((work) => (
        <WorkItem key={work.id} work={work} />
      ))}
    </nav>
  );
}

function WorkItem({ work }: { work: NavWork }) {
  return (
    <div className="group relative">
      <Link
        href={`/works/${work.slug}`}
        className={cn(
          "inline-flex h-9 items-center rounded-full px-4 text-sm font-bold tracking-[var(--tracking-button)]",
          "text-[color:var(--color-muted-foreground)] transition",
          "hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
        )}
      >
        {work.nameKo}
      </Link>
      {work.bands.length > 0 && (
        <div
          className={cn(
            "invisible absolute left-0 top-full z-50 min-w-[14rem] -translate-y-1 pt-1 opacity-0 transition",
            "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
            "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
          )}
        >
          <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-surface-2)] p-1.5 shadow-[var(--shadow-dialog)]">
            <Link
              href={`/works/${work.slug}`}
              className="block rounded-[var(--radius-md)] px-3 py-2 text-[11px] font-bold uppercase tracking-[var(--tracking-button)] text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
            >
              전체 {work.nameKo}
            </Link>
            {work.bands.map((band) => (
              <Link
                key={band.id}
                href={`/bands/${band.slug}`}
                className="block rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold hover:bg-[color:var(--color-muted)]"
              >
                <span>{band.nameKo}</span>
                {band.nameJp && band.nameJp !== band.nameKo && (
                  <span className="ml-2 text-xs font-normal text-[color:var(--color-muted-foreground)]">
                    {band.nameJp}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
