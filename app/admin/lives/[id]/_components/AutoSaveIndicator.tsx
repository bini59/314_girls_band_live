"use client";

import type { AutoSaveStatus } from "@/lib/admin/auto-save";

import { Button } from "@/components/ui/button";

/**
 * 자동저장 상태 인디케이터.
 *
 * UX_LIVE_EDITOR §1.저장 상태 표.
 * - idle / saved → "● 모두 저장됨 HH:mm:ss JST"
 * - saving        → "◐ 저장 중…"
 * - error         → "⚠ 저장 실패 — 재시도"
 * - dirty         → "… 편집 중"
 *
 * 접근성: aria-live="polite" 로 상태 변화를 스크린리더가 안내.
 */
export function AutoSaveIndicator({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: AutoSaveStatus;
  lastSavedAt: string | null;
  onRetry?: () => void;
}) {
  let content: React.ReactNode;
  switch (status) {
    case "saving":
      content = <>◐ 저장 중…</>;
      break;
    case "error":
      content = (
        <span className="text-[color:var(--color-destructive)]">
          ⚠ 저장 실패
          {onRetry ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onRetry}
              className="ml-2 h-7 px-2 text-xs"
            >
              재시도
            </Button>
          ) : null}
        </span>
      );
      break;
    case "dirty":
      content = (
        <span className="text-[color:var(--color-muted-foreground)]">
          … 편집 중
        </span>
      );
      break;
    case "saved":
    case "idle":
    default:
      content = (
        <span className="text-[color:var(--color-muted-foreground)]">
          ● 저장됨
          {lastSavedAt ? ` · ${formatTime(lastSavedAt)} JST` : ""}
        </span>
      );
  }

  return (
    <div
      aria-live="polite"
      role="status"
      className="text-sm tabular-nums"
    >
      {content}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 19);
}
