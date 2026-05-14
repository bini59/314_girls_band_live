"use client";

/**
 * BandsTable — 밴드 목록 + 추가/편집/삭제 + 작품 필터.
 *
 *  - 추가/편집은 별도 상세 페이지(/admin/bands/new, /admin/bands/[id]/edit)로 이동.
 *  - 작품 필터: workId 셀렉트 → 클라이언트 측 필터링.
 *  - snsLinks 는 카드 형태로 키만 노출 (간략).
 */

import * as React from "react";
import Link from "next/link";
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
import { coerceSnsLinks } from "@/lib/admin/sns-links";

import { deleteBandAction } from "../actions";

export interface BandsTableProps {
  bands: BandWithWork[];
  works: Work[];
}

const ALL_WORKS = "__all__";
const DELETE_CONFIRM_MESSAGE =
  "이 밴드를 삭제하시겠습니까? 라이브 출연 이력이 있으면 삭제할 수 없습니다.";

export function BandsTable({ bands, works }: BandsTableProps) {
  const router = useRouter();
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

  const addDisabled = works.length === 0;

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
            className="flex h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-1 text-sm shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] outline-none"
          >
            <option value={ALL_WORKS}>전체 작품</option>
            {works.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.nameKo}
              </option>
            ))}
          </select>
        </div>
        {addDisabled ? (
          <Button disabled>+ 밴드 추가</Button>
        ) : (
          <Link
            href="/admin/bands/new"
            className="inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-4 text-sm font-bold tracking-[var(--tracking-button)] text-[color:var(--color-primary-foreground)] transition hover:brightness-110 hover:scale-[1.02]"
          >
            + 밴드 추가
          </Link>
        )}
      </div>

      {works.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] bg-[color:var(--color-muted)] p-4 text-sm text-[color:var(--color-muted-foreground)]">
          먼저{" "}
          <a href="/admin/works" className="underline">
            작품
          </a>
          을 등록해주세요. 밴드는 작품에 속합니다.
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
        <p className="rounded-[var(--radius-lg)] bg-[color:var(--color-muted)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
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
              const sns = coerceSnsLinks(b.snsLinks);
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
                      <Link
                        href={`/admin/bands/${b.id}/edit`}
                        aria-label={`${b.nameKo} 편집`}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-transparent px-4 text-xs font-bold tracking-[var(--tracking-button)] text-[color:var(--color-foreground)] transition hover:border-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
                      >
                        편집
                      </Link>
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
    </div>
  );
}
