"use client";

/**
 * VendorsTable — 발매처 목록 + 추가/편집/삭제 진입점.
 *
 * - "+ 판매처 추가" 버튼: VendorDialog mode="create".
 * - 각 row: 편집 / 삭제 버튼.
 *   - 편집: VendorDialog mode="edit" (initial 주입).
 *   - 삭제: window.confirm 후 deleteVendorAction 호출.
 * - 모든 mutation 후 router.refresh() 로 서버 컴포넌트 재페치.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Vendor } from "@prisma/client";

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
  createVendorAction,
  deleteVendorAction,
  updateVendorAction,
} from "../actions";

import {
  VendorDialog,
  type VendorDialogInitial,
  type VendorDialogValues,
} from "./VendorDialog";

export interface VendorsTableProps {
  vendors: Vendor[];
}

type DialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; vendor: Vendor };

const DELETE_CONFIRM_MESSAGE =
  "이 발매처를 삭제하시겠습니까? 라이브의 판매 라운드에서 참조 중이면 삭제할 수 없습니다.";

export function VendorsTable({ vendors }: VendorsTableProps) {
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

  function openEdit(vendor: Vendor) {
    setTopError(null);
    setDialog({ open: true, mode: "edit", vendor });
  }

  function closeDialog() {
    setDialog({ open: false });
  }

  async function handleSubmit(
    values: VendorDialogValues
  ): Promise<
    | { ok: true }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  > {
    if (!dialog.open) {
      return { ok: false, error: "다이얼로그 상태 오류." };
    }

    if (dialog.mode === "create") {
      const result = await createVendorAction({
        slug: values.slug,
        name: values.name,
        baseUrl: values.baseUrl,
        logoUrl: values.logoUrl,
        notes: values.notes,
      });
      if (result.ok) {
        router.refresh();
        return { ok: true };
      }
      return {
        ok: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    // edit
    const result = await updateVendorAction(dialog.vendor.id, {
      slug: values.slug,
      name: values.name,
      baseUrl: values.baseUrl,
      logoUrl: values.logoUrl,
      notes: values.notes,
    });
    if (result.ok) {
      router.refresh();
      return { ok: true };
    }
    return {
      ok: false,
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  async function handleDelete(vendor: Vendor) {
    if (typeof window !== "undefined") {
      if (!window.confirm(DELETE_CONFIRM_MESSAGE)) {
        return;
      }
    }
    setTopError(null);
    setPendingDeleteId(vendor.id);
    try {
      const result = await deleteVendorAction(vendor.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result.error ?? "삭제에 실패했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  const initial: VendorDialogInitial | undefined =
    dialog.open && dialog.mode === "edit"
      ? {
          id: dialog.vendor.id,
          slug: dialog.vendor.slug,
          name: dialog.vendor.name,
          baseUrl: dialog.vendor.baseUrl ?? "",
          logoUrl: dialog.vendor.logoUrl ?? "",
          notes: dialog.vendor.notes ?? "",
        }
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>+ 판매처 추가</Button>
      </div>

      {topError ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {topError}
        </p>
      ) : null}

      {vendors.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          등록된 발매처가 없습니다. 우측 상단 버튼으로 추가해주세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">slug</TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="w-56">기본 URL</TableHead>
              <TableHead>메모</TableHead>
              <TableHead className="w-32 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`}>
                <TableCell className="font-mono text-xs">
                  {vendor.slug}
                </TableCell>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {vendor.baseUrl ? (
                    <a
                      href={vendor.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {vendor.baseUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                  {vendor.notes ? truncate(vendor.notes, 80) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(vendor)}
                      aria-label={`${vendor.name} 편집`}
                    >
                      편집
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(vendor)}
                      disabled={pendingDeleteId === vendor.id}
                      aria-label={`${vendor.name} 삭제`}
                    >
                      {pendingDeleteId === vendor.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <VendorDialog
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
