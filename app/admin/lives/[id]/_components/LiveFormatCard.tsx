/**
 * LiveFormatCard — LiveFormat 단일 표시 카드.
 *
 * - type 배지 (현지 공연 / 라이브뷰잉 / 배포).
 * - label / venueName / url 표시.
 * - 편집 / 삭제 액션 (삭제는 confirm 한 단계 거침).
 * - tierSlot prop 으로 TicketTier 섹션을 nested 렌더 (Group 3 가 채움).
 *
 * Group 3 에서 본 파일은 수정하지 않으며, 본 컴포넌트의 tierSlot prop 만 사용한다.
 */
"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { LiveFormatLike } from "./LiveFormatDialog";

const TYPE_LABEL: Record<LiveFormatLike["type"], string> = {
  LIVE_VENUE: "현지 공연",
  LIVE_VIEWING: "라이브뷰잉",
  STREAMING: "배포",
};

const DELETE_CONFIRM_MESSAGE =
  "이 포맷을 삭제하면 연결된 티어/판매 라운드도 함께 사라집니다. 진행하시겠습니까?";

export interface LiveFormatCardProps {
  format: LiveFormatLike;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  tierSlot?: React.ReactNode;
}

export function LiveFormatCard({
  format,
  onEdit,
  onDelete,
  disabled = false,
  tierSlot,
}: LiveFormatCardProps) {
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDeleteClick(): Promise<void> {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  function handleCancelConfirm(): void {
    setConfirming(false);
  }

  const isBusy = disabled || deleting;

  return (
    <article
      data-testid="live-format-card"
      data-format-id={format.id}
      className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{TYPE_LABEL[format.type]}</Badge>
            {format.label ? (
              <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                {format.label}
              </span>
            ) : null}
          </div>
          {format.venueName ? (
            <p className="text-sm text-[color:var(--color-foreground)]">
              {format.venueName}
            </p>
          ) : null}
          {format.url ? (
            <a
              href={format.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[color:var(--color-primary)] underline-offset-2 hover:underline break-all"
            >
              {format.url}
            </a>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isBusy}
          >
            편집
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteClick}
            disabled={isBusy}
          >
            {confirming ? "삭제 확정" : "삭제"}
          </Button>
        </div>
      </div>

      {confirming ? (
        <div
          role="alert"
          className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-destructive)] bg-[color:var(--color-muted)] p-3 text-sm text-[color:var(--color-foreground)]"
        >
          <p>{DELETE_CONFIRM_MESSAGE}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelConfirm}
              disabled={deleting}
            >
              취소
            </Button>
          </div>
        </div>
      ) : null}

      {tierSlot ? <div className="mt-4">{tierSlot}</div> : null}
    </article>
  );
}
