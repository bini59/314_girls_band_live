"use client";

/**
 * TicketSalesSection — 판매 라운드 섹션 (Group 5).
 *
 * 책임:
 *  - 현재 라이브의 모든 TicketSale 표시 (startsAt asc 정렬).
 *  - "+ 라운드 추가" 로 다이얼로그를 열어 생성.
 *  - 카드의 편집 / 삭제 액션.
 *  - 옵티미스틱 업데이트 + 실패 시 롤백.
 *
 * 컨벤션:
 *  - 클라이언트 컴포넌트. 서버 액션 직접 호출.
 *  - 카드 정렬은 `startsAt` ISO 문자열 lexicographic 비교 (UTC ISO 는 시각 순서를 보존).
 */
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import {
  createTicketSaleAction,
  deleteTicketSaleAction,
  setTicketSaleTiersAction,
  updateTicketSaleAction,
  type SerializedTicketSale,
  type TicketSaleFormInput,
  type TicketSaleActionResult,
} from "../ticket-sale-actions";

import { SectionCard } from "./SectionCard";
import { TicketSaleCard } from "./TicketSaleCard";
import { TicketSaleDialog } from "./TicketSaleDialog";
import type { TierMultiSelectFormat } from "./TierMultiSelect";

export interface TicketSalesSectionProps {
  liveId: number;
  initialSales: SerializedTicketSale[];
  vendors: Array<{ id: number; name: string }>;
  formats: TierMultiSelectFormat[];
}

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; sale: SerializedTicketSale };

/** UTC ISO 문자열 → JST 입력 (YYYY-MM-DDTHH:mm). */
function isoToJstLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** edit 다이얼로그 초기값 — SerializedTicketSale → TicketSaleFormInput. */
function toFormInput(sale: SerializedTicketSale): TicketSaleFormInput {
  return {
    vendorId: sale.vendorId,
    type: sale.type,
    method: sale.method,
    label: sale.label ?? "",
    startsAtJst: isoToJstLocal(sale.startsAt),
    endsAtJst: isoToJstLocal(sale.endsAt),
    announceAtJst: isoToJstLocal(sale.announceAt),
    paymentDeadlineAtJst: isoToJstLocal(sale.paymentDeadlineAt),
    url: sale.url ?? "",
    notes: sale.notes ?? "",
    tierIds: sale.tiers.map((t) => t.id),
  };
}

export function TicketSalesSection({
  liveId,
  initialSales,
  vendors,
  formats,
}: TicketSalesSectionProps): React.JSX.Element {
  const [sales, setSales] = useState<SerializedTicketSale[]>(initialSales);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...sales].sort((a, b) => {
        if (a.startsAt === b.startsAt) return a.id - b.id;
        return a.startsAt < b.startsAt ? -1 : 1;
      }),
    [sales]
  );

  /**
   * 생성. 서버가 sale 을 반환하면 ID 가 확정된 row 로 교체.
   */
  async function handleCreate(
    values: TicketSaleFormInput
  ): Promise<TicketSaleActionResult> {
    const result = await createTicketSaleAction(liveId, values);
    if (result.ok && result.sale) {
      const saved = result.sale;
      startTransition(() => {
        setSales((prev) => [...prev, saved]);
      });
    }
    return result;
  }

  /**
   * 편집.
   *  - 옵티미스틱: 새 값으로 카드를 즉시 교체.
   *  - 실패 시 원본으로 롤백.
   *  - tier 변경은 별도 setTicketSaleTiersAction.
   */
  async function handleEdit(
    sale: SerializedTicketSale,
    values: TicketSaleFormInput
  ): Promise<TicketSaleActionResult> {
    const original = sale;
    const optimistic: SerializedTicketSale = {
      ...sale,
      vendorId: values.vendorId ?? sale.vendorId,
      type: values.type ?? sale.type,
      method: values.method ?? sale.method,
      label: values.label ? values.label : null,
      url: values.url ? values.url : null,
      notes: values.notes ? values.notes : null,
    };
    setSales((prev) => prev.map((s) => (s.id === sale.id ? optimistic : s)));

    // tierIds 가 기존과 다르면 setTicketSaleTiers 도 호출.
    const before = [...sale.tiers.map((t) => t.id)].sort((a, b) => a - b);
    const after = [...(values.tierIds ?? [])].sort((a, b) => a - b);
    const tiersChanged =
      before.length !== after.length ||
      before.some((v, i) => v !== after[i]);

    const updateResult = await updateTicketSaleAction(sale.id, values);
    if (!updateResult.ok) {
      setSales((prev) => prev.map((s) => (s.id === sale.id ? original : s)));
      return updateResult;
    }

    if (tiersChanged) {
      const tierResult = await setTicketSaleTiersAction(
        sale.id,
        values.tierIds ?? []
      );
      if (!tierResult.ok) {
        setSales((prev) => prev.map((s) => (s.id === sale.id ? original : s)));
        return tierResult;
      }
    }

    return { ok: true };
  }

  async function handleDelete(saleId: number): Promise<void> {
    const original = sales;
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    const result = await deleteTicketSaleAction(saleId);
    if (!result.ok) {
      setSales(original);
    }
  }

  const action = (
    <Button
      type="button"
      size="sm"
      onClick={() => setDialog({ kind: "create" })}
    >
      + 라운드 추가
    </Button>
  );

  return (
    <SectionCard
      title="판매 라운드"
      description="선행 / 일반 / 추첨 / 선착 라운드와 발매처"
      action={action}
    >
      {sorted.length === 0 ? (
        <p
          data-testid="ticket-sales-empty"
          className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted-foreground)]"
        >
          판매/추첨 라운드를 추가하세요. (선행, 일반, 추첨, 선착)
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((sale) => (
            <li key={sale.id}>
              <TicketSaleCard
                sale={sale}
                onEdit={() => setDialog({ kind: "edit", sale })}
                onDelete={() => handleDelete(sale.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <TicketSaleDialog
        open={dialog.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        mode={dialog.kind === "edit" ? "edit" : "create"}
        initial={dialog.kind === "edit" ? toFormInput(dialog.sale) : undefined}
        vendors={vendors}
        formats={formats}
        onSubmit={async (values) => {
          if (dialog.kind === "edit") {
            return handleEdit(dialog.sale, values);
          }
          return handleCreate(values);
        }}
      />
    </SectionCard>
  );
}
