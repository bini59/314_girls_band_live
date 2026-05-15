"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { NavWork } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

/**
 * 모바일 헤더 메뉴.
 * - 햄버거 버튼으로 열고 닫는 슬라이드다운 패널.
 * - 작품 행을 탭하면 작품 페이지로 즉시 이동, 우측 chevron으로 밴드 펼치기.
 * - 경로 변경 시 자동 닫힘.
 */
export function MobileMenu({ works }: { works: NavWork[] }) {
  const [open, setOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-muted)] text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-14 z-30 cursor-default bg-black/50 backdrop-blur-sm"
          />
          <div
            id="mobile-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto bg-[color:var(--color-surface-2)] shadow-[var(--shadow-dialog)]"
          >
            <nav aria-label="작품" className="p-2">
              {works.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
                  작품이 없습니다.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {works.map((work) => {
                    const isExpanded = expandedId === work.id;
                    const hasBands = work.bands.length > 0;
                    return (
                      <li key={work.id}>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/works/${work.slug}`}
                            className="min-w-0 flex-1 truncate rounded-[var(--radius-md)] px-3 py-3 text-sm font-bold tracking-[var(--tracking-button)] text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
                          >
                            {work.nameKo}
                          </Link>
                          {hasBands && (
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? `${work.nameKo} 밴드 접기`
                                  : `${work.nameKo} 밴드 펼치기`
                              }
                              onClick={() =>
                                setExpandedId((id) =>
                                  id === work.id ? null : work.id
                                )
                              }
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
                            >
                              <IconChevron expanded={isExpanded} />
                            </button>
                          )}
                        </div>
                        {hasBands && isExpanded && (
                          <ul className="mb-1 ml-3 border-l border-[color:var(--color-border)] pl-2">
                            {work.bands.map((band) => (
                              <li key={band.id}>
                                <Link
                                  href={`/bands/${band.slug}`}
                                  className="block rounded-[var(--radius-md)] px-3 py-2 text-sm hover:bg-[color:var(--color-muted)]"
                                >
                                  <span className="font-semibold">
                                    {band.nameKo}
                                  </span>
                                  {band.nameJp && band.nameJp !== band.nameKo && (
                                    <span className="ml-2 text-xs text-[color:var(--color-muted-foreground)]">
                                      {band.nameJp}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

function IconMenu() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function IconChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("transition-transform", expanded && "rotate-180")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
