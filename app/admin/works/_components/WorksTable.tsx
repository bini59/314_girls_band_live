"use client";

/**
 * WorksTable — 작품 목록 + 추가/편집/삭제 진입점.
 *
 *  - 추가/편집은 별도 상세 페이지(/admin/works/new, /admin/works/[id]/edit)로 이동.
 *  - 삭제 confirm: 밴드가 있으면 삭제 차단 메시지.
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

import type { WorkWithSeries } from "@/lib/works/repo";

import { deleteWorkAction } from "../actions";

export interface WorksTableProps {
  works: WorkWithSeries[];
}

const DELETE_CONFIRM_MESSAGE =
  "이 작품을 삭제하시겠습니까? 연결된 밴드가 있으면 삭제할 수 없습니다.";

export function WorksTable({ works }: WorksTableProps) {
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(
    null
  );
  const [topError, setTopError] = React.useState<string | null>(null);

  async function handleDelete(w: WorkWithSeries) {
    if (typeof window !== "undefined") {
      if (!window.confirm(DELETE_CONFIRM_MESSAGE)) return;
    }
    setTopError(null);
    setPendingDeleteId(w.id);
    try {
      const result = await deleteWorkAction(w.id);
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
          href="/admin/works/new"
          className="inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-4 text-sm font-bold tracking-[var(--tracking-button)] text-[color:var(--color-primary-foreground)] transition hover:brightness-110 hover:scale-[1.02]"
        >
          + 작품 추가
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

      {works.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] bg-[color:var(--color-muted)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          등록된 작품이 없습니다. 우측 상단 버튼으로 추가해주세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">slug</TableHead>
              <TableHead>한국어 / 일본어</TableHead>
              <TableHead className="w-40">시리즈</TableHead>
              <TableHead className="w-24">종류</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.map((w) => (
              <TableRow key={w.id} data-testid={`work-row-${w.id}`}>
                <TableCell className="font-mono text-xs">{w.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{w.nameKo}</div>
                  <div className="text-xs text-[color:var(--color-muted-foreground)]">
                    {w.nameJp}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {w.series ? w.series.nameKo : "—"}
                </TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {w.kind ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Link
                      href={`/admin/works/${w.id}/edit`}
                      aria-label={`${w.nameKo} 편집`}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-transparent px-4 text-xs font-bold tracking-[var(--tracking-button)] text-[color:var(--color-foreground)] transition hover:border-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
                    >
                      편집
                    </Link>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(w)}
                      disabled={pendingDeleteId === w.id}
                      aria-label={`${w.nameKo} 삭제`}
                    >
                      {pendingDeleteId === w.id ? "삭제 중..." : "삭제"}
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
