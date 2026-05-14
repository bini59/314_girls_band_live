"use client";

/**
 * WorksTable — 작품 목록 + 추가/편집/삭제 진입점.
 *
 *  - 삭제 confirm: 밴드가 있으면 삭제 차단 메시지.
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

import type { WorkWithSeries } from "@/lib/works/repo";

import {
  createWorkAction,
  deleteWorkAction,
  updateWorkAction,
} from "../actions";

import {
  WorkDialog,
  type WorkDialogInitial,
  type WorkDialogValues,
} from "./WorkDialog";

export interface WorksTableProps {
  works: WorkWithSeries[];
  series: Series[];
}

type DialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; work: WorkWithSeries };

const DELETE_CONFIRM_MESSAGE =
  "이 작품을 삭제하시겠습니까? 연결된 밴드가 있으면 삭제할 수 없습니다.";

export function WorksTable({ works, series }: WorksTableProps) {
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

  function openEdit(w: WorkWithSeries) {
    setTopError(null);
    setDialog({ open: true, mode: "edit", work: w });
  }

  function closeDialog() {
    setDialog({ open: false });
  }

  async function handleSubmit(values: WorkDialogValues) {
    if (!dialog.open) {
      return { ok: false as const, error: "다이얼로그 상태 오류." };
    }

    if (dialog.mode === "create") {
      const result = await createWorkAction(values);
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

    const result = await updateWorkAction(dialog.work.id, values);
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

  const initial: WorkDialogInitial | undefined =
    dialog.open && dialog.mode === "edit"
      ? {
          id: dialog.work.id,
          slug: dialog.work.slug,
          nameKo: dialog.work.nameKo,
          nameJp: dialog.work.nameJp,
          nameEn: dialog.work.nameEn ?? "",
          kind: dialog.work.kind ?? "",
          logoUrl: dialog.work.logoUrl ?? "",
          description: dialog.work.description ?? "",
          seriesId: dialog.work.seriesId ?? null,
        }
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>+ 작품 추가</Button>
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
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(w)}
                      aria-label={`${w.nameKo} 편집`}
                    >
                      편집
                    </Button>
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

      <WorkDialog
        open={dialog.open}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
        mode={dialog.open ? dialog.mode : "create"}
        initial={initial}
        series={series}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
