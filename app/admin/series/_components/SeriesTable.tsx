"use client";

/**
 * SeriesTable — 시리즈 목록 + 추가/편집/삭제 진입점.
 *
 *  - 삭제 confirm: "연결된 작품은 시리즈 없음 상태가 됩니다" 명시 (SetNull).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Series } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  createSeriesAction,
  deleteSeriesAction,
  updateSeriesAction,
} from "../actions";

import {
  SeriesDialog,
  type SeriesDialogInitial,
  type SeriesDialogValues,
} from "./SeriesDialog";

export interface SeriesTableProps {
  series: Series[];
}

type DialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; series: Series };

const DELETE_CONFIRM_MESSAGE =
  "이 시리즈를 삭제하시겠습니까? 연결된 작품은 '시리즈 없음' 상태로 detach 됩니다.";

export function SeriesTable({ series }: SeriesTableProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>({ open: false });
  const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(
    null
  );
  const [topError, setTopError] = React.useState<string | null>(null);

  function openCreate() {
    setTopError(null);
    setDialog({ open: true, mode: "create" });
  }

  function openEdit(s: Series) {
    setTopError(null);
    setDialog({ open: true, mode: "edit", series: s });
  }

  function closeDialog() {
    setDialog({ open: false });
  }

  async function handleSubmit(values: SeriesDialogValues) {
    if (!dialog.open) {
      return { ok: false as const, error: "다이얼로그 상태 오류." };
    }

    if (dialog.mode === "create") {
      const result = await createSeriesAction(values);
      if (result.ok) {
        router.refresh();
        return { ok: true as const };
      }
      return {
        ok: false as const,
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    const result = await updateSeriesAction(dialog.series.id, values);
    if (result.ok) {
      router.refresh();
      return { ok: true as const };
    }
    return {
      ok: false as const,
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  async function handleDelete(s: Series) {
    if (typeof window !== "undefined") {
      if (!window.confirm(DELETE_CONFIRM_MESSAGE)) return;
    }
    setTopError(null);
    setPendingDeleteId(s.id);
    try {
      const result = await deleteSeriesAction(s.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result.error ?? "삭제에 실패했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  const initial: SeriesDialogInitial | undefined =
    dialog.open && dialog.mode === "edit"
      ? {
          id: dialog.series.id,
          slug: dialog.series.slug,
          nameKo: dialog.series.nameKo,
          nameJp: dialog.series.nameJp,
          nameEn: dialog.series.nameEn ?? "",
          logoUrl: dialog.series.logoUrl ?? "",
          description: dialog.series.description ?? "",
        }
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>+ 시리즈 추가</Button>
      </div>

      {topError ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {topError}
        </p>
      ) : null}

      {series.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          등록된 시리즈가 없습니다. 우측 상단 버튼으로 추가해주세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">slug</TableHead>
              <TableHead>한국어 / 일본어</TableHead>
              <TableHead className="w-48">설명</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.map((s) => (
              <TableRow key={s.id} data-testid={`series-row-${s.id}`}>
                <TableCell className="font-mono text-xs">{s.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{s.nameKo}</div>
                  <div className="text-xs text-[color:var(--color-muted-foreground)]">
                    {s.nameJp}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {s.description ? truncate(s.description, 60) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(s)}
                      aria-label={`${s.nameKo} 편집`}
                    >
                      편집
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(s)}
                      disabled={pendingDeleteId === s.id}
                      aria-label={`${s.nameKo} 삭제`}
                    >
                      {pendingDeleteId === s.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SeriesDialog
        open={dialog.open}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
        mode={dialog.open ? dialog.mode : "create"}
        initial={initial}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
