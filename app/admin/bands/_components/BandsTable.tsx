"use client";

/**
 * BandsTable — 밴드 목록 + 추가/편집/삭제 + 작품 필터.
 *
 *  - 작품 필터: workId 셀렉트 → 클라이언트 측 필터링.
 *  - snsLinks 는 카드 형태로 키만 노출 (간략).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Work } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BandWithWork } from "@/lib/band/repo";

import {
  createBandAction,
  deleteBandAction,
  updateBandAction,
} from "../actions";

import {
  BandDialog,
  type BandDialogInitial,
} from "./BandDialog";

export interface BandsTableProps {
  bands: BandWithWork[];
  works: Work[];
}

type DialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; band: BandWithWork };

const ALL_WORKS = "__all__";
const DELETE_CONFIRM_MESSAGE =
  "이 밴드를 삭제하시겠습니까? 라이브 출연 이력이 있으면 삭제할 수 없습니다.";

export function BandsTable({ bands, works }: BandsTableProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>({ open: false });
  const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(
    null
  );
  const [topError, setTopError] = React.useState<string | null>(null);
  const [filterWorkId, setFilterWorkId] = React.useState<string>(ALL_WORKS);

  const filteredBands = React.useMemo(() => {
    if (filterWorkId === ALL_WORKS) return bands;
    const id = Number(filterWorkId);
    return bands.filter((b) => b.workId === id);
  }, [bands, filterWorkId]);

  function openCreate() {
    setTopError(null);
    setDialog({ open: true, mode: "create" });
  }

  function openEdit(b: BandWithWork) {
    setTopError(null);
    setDialog({ open: true, mode: "edit", band: b });
  }

  function closeDialog() {
    setDialog({ open: false });
  }

  async function handleSubmit(payload: {
    workId: number | null;
    slug: string;
    nameKo: string;
    nameJp: string;
    nameEn: string;
    officialUrl: string;
    imageUrl: string;
    description: string;
    snsLinks: Record<string, string>;
  }) {
    if (!dialog.open) {
      return { ok: false as const, error: "다이얼로그 상태 오류." };
    }

    if (payload.workId === null) {
      return {
        ok: false as const,
        fieldErrors: { workId: ["작품을 선택해주세요."] },
      };
    }

    if (dialog.mode === "create") {
      const result = await createBandAction({
        workId: payload.workId,
        slug: payload.slug,
        nameKo: payload.nameKo,
        nameJp: payload.nameJp,
        nameEn: payload.nameEn,
        officialUrl: payload.officialUrl,
        imageUrl: payload.imageUrl,
        description: payload.description,
        snsLinks: payload.snsLinks,
      });
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

    const result = await updateBandAction(dialog.band.id, {
      workId: payload.workId,
      slug: payload.slug,
      nameKo: payload.nameKo,
      nameJp: payload.nameJp,
      nameEn: payload.nameEn,
      officialUrl: payload.officialUrl,
      imageUrl: payload.imageUrl,
      description: payload.description,
      snsLinks: payload.snsLinks,
    });
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

  async function handleDelete(b: BandWithWork) {
    if (typeof window !== "undefined") {
      if (!window.confirm(DELETE_CONFIRM_MESSAGE)) return;
    }
    setTopError(null);
    setPendingDeleteId(b.id);
    try {
      const result = await deleteBandAction(b.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result.error ?? "삭제에 실패했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  const initial: BandDialogInitial | undefined =
    dialog.open && dialog.mode === "edit"
      ? {
          id: dialog.band.id,
          workId: dialog.band.workId,
          slug: dialog.band.slug,
          nameKo: dialog.band.nameKo,
          nameJp: dialog.band.nameJp,
          nameEn: dialog.band.nameEn ?? "",
          officialUrl: dialog.band.officialUrl ?? "",
          imageUrl: dialog.band.imageUrl ?? "",
          description: dialog.band.description ?? "",
          snsLinks: (dialog.band.snsLinks ?? null) as Record<string, string> | null,
        }
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="band-filter" className="text-sm">
            작품
          </Label>
          <select
            id="band-filter"
            value={filterWorkId}
            onChange={(e) => setFilterWorkId(e.target.value)}
            className="flex h-9 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-1 text-sm shadow-sm"
          >
            <option value={ALL_WORKS}>전체 작품</option>
            {works.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.nameKo}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={openCreate} disabled={works.length === 0}>
          + 밴드 추가
        </Button>
      </div>

      {works.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted-foreground)]">
          먼저 <a href="/admin/works" className="underline">작품</a>을 등록해주세요.
          밴드는 작품에 속합니다.
        </p>
      ) : null}

      {topError ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {topError}
        </p>
      ) : null}

      {filteredBands.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          {bands.length === 0
            ? "등록된 밴드가 없습니다. 우측 상단 버튼으로 추가해주세요."
            : "해당 작품에 등록된 밴드가 없습니다."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">slug</TableHead>
              <TableHead>한국어 / 일본어</TableHead>
              <TableHead className="w-40">작품</TableHead>
              <TableHead className="w-32">SNS</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBands.map((b) => {
              const sns = (b.snsLinks ?? null) as
                | Record<string, string>
                | null;
              const snsKeys = sns ? Object.keys(sns) : [];
              return (
                <TableRow key={b.id} data-testid={`band-row-${b.id}`}>
                  <TableCell className="font-mono text-xs">{b.slug}</TableCell>
                  <TableCell>
                    <div className="font-medium">{b.nameKo}</div>
                    <div className="text-xs text-[color:var(--color-muted-foreground)]">
                      {b.nameJp}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                    {b.work.nameKo}
                  </TableCell>
                  <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                    {snsKeys.length === 0 ? "—" : snsKeys.join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(b)}
                        aria-label={`${b.nameKo} 편집`}
                      >
                        편집
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(b)}
                        disabled={pendingDeleteId === b.id}
                        aria-label={`${b.nameKo} 삭제`}
                      >
                        {pendingDeleteId === b.id ? "삭제 중..." : "삭제"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <BandDialog
        open={dialog.open}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
        mode={dialog.open ? dialog.mode : "create"}
        initial={initial}
        works={works}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
