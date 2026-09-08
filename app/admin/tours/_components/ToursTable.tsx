"use client";

/**
 * ToursTable — 투어 목록 + 추가/편집/삭제 진입점.
 *
 *  - 추가/편집은 별도 페이지(/admin/tours/new, /admin/tours/[id]/edit).
 *  - 삭제: 연결된 라이브는 보존되고 Live.tourId 만 NULL 처리됨 (onDelete SetNull).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TourWithCounts } from "@/lib/tours/repo";

import { deleteTourAction } from "../actions";

export interface ToursTableProps {
  /** 현재 검색어 — 빈 상태 문구 분기에 사용. */
  q?: string;
  tours: TourWithCounts[];
}

const DELETE_CONFIRM_MESSAGE =
  "이 투어를 삭제하시겠습니까? 연결된 라이브는 보존되고 투어 연결만 해제됩니다.";

export function ToursTable({ tours, q }: ToursTableProps) {
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(
    null
  );
  const [topError, setTopError] = React.useState<string | null>(null);

  async function handleDelete(t: TourWithCounts) {
    if (typeof window !== "undefined") {
      if (!window.confirm(DELETE_CONFIRM_MESSAGE)) return;
    }
    setTopError(null);
    setPendingDeleteId(t.id);
    try {
      const result = await deleteTourAction(t.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result.error ?? "삭제에 실패했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Link
          href="/admin/tours/new"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-accent px-3 text-[13px] font-medium text-accent-fg no-underline hover:opacity-[.88] hover:no-underline"
        >
          + 투어 추가
        </Link>
      </div>

      {topError ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {topError}
        </p>
      ) : null}

      {tours.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          {q ? `"${q}" 검색 결과가 없습니다.` : "등록된 투어가 없습니다. 우측 상단 버튼으로 추가해주세요."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">slug</TableHead>
              <TableHead>한국어 / 일본어</TableHead>
              <TableHead className="w-40">작품</TableHead>
              <TableHead className="w-20 text-right">회차</TableHead>
              <TableHead className="w-20">상태</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tours.map((t) => (
              <TableRow key={t.id} data-testid={`tour-row-${t.id}`}>
                <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{t.nameKo}</div>
                  <div className="text-xs text-[color:var(--color-muted-foreground)]">
                    {t.nameJp}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {t.work.nameKo}
                </TableCell>
                <TableCell className="text-right text-xs text-[color:var(--color-muted-foreground)]">
                  {t._count.lives}
                </TableCell>
                <TableCell className="text-xs">
                  {t.status === "PUBLISHED" ? (
                    <span className="rounded-full bg-[color:var(--color-primary)]/20 px-2 py-0.5 text-[color:var(--color-primary)]">
                      공개
                    </span>
                  ) : (
                    <span className="rounded-full bg-[color:var(--color-muted)] px-2 py-0.5 text-[color:var(--color-muted-foreground)]">
                      초안
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Link
                      href={`/admin/tours/${t.id}/edit`}
                      aria-label={`${t.nameKo} 편집`}
                      className="inline-flex h-[26px] items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-raise px-[9px] text-xs text-fg no-underline hover:bg-panel-2 hover:no-underline"
                    >
                      편집
                    </Link>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(t)}
                      disabled={pendingDeleteId === t.id}
                      aria-label={`${t.nameKo} 삭제`}
                    >
                      {pendingDeleteId === t.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
