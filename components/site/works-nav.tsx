"use client";

import Link from "next/link";
import * as React from "react";

import type { NavWork } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

/**
 * 작품(Work) 메뉴 — Spotify pill 네비.
 *
 * - 데스크탑: 가로 pill + hover/focus-within 드롭다운
 * - 모바일: 가로 스크롤 pill + 클릭 토글
 */
export function WorksNav({ works }: { works: NavWork[] }) {
  const [openId, setOpenId] = React.useState<number | null>(null);

  if (works.length === 0) return null;

  return (
    <>
      {/* 데스크탑 */}
      <nav aria-label="작품" className="hidden md:flex md:items-stretch md:gap-1">
        {works.map((work) => (
          <WorkItem key={work.id} work={work} />
        ))}
      </nav>

      {/* 모바일 */}
      <nav
        aria-label="작품 (모바일)"
        className="-mx-3 flex w-[calc(100%+1.5rem)] gap-1.5 overflow-x-auto px-3 pb-1 md:hidden"
      >
        {works.map((work) => (
          <MobileWorkItem
            key={work.id}
            work={work}
            open={openId === work.id}
            onToggle={() => setOpenId((id) => (id === work.id ? null : work.id))}
          />
        ))}
      </nav>
    </>
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

function MobileWorkItem({
  work,
  open,
  onToggle,
}: {
  work: NavWork;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center rounded-full px-3 text-xs font-bold tracking-[var(--tracking-button)] transition",
          open
            ? "bg-[color:var(--color-foreground)] text-[color:var(--color-background)]"
            : "bg-[color:var(--color-muted)] text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface-2)]"
        )}
      >
        {work.nameKo}
      </button>
      {open && work.bands.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link
            href={`/works/${work.slug}`}
            className="rounded-full bg-[color:var(--color-muted)] px-3 py-1 text-xs font-semibold"
          >
            전체
          </Link>
          {work.bands.map((band) => (
            <Link
              key={band.id}
              href={`/bands/${band.slug}`}
              className="rounded-full bg-[color:var(--color-muted)] px-3 py-1 text-xs"
            >
              {band.nameKo}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
