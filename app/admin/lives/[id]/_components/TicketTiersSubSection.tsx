"use client";

/**
 * TicketTiersSubSection — LiveFormatCard 내부에 슬롯되는 티어 sub-section.
 *
 * 디자인:
 *  - SectionCard 가 아닌 nested block (얇은 보더 + "티켓 티어" 헤딩).
 *  - 헤더 우측: "+ 티어 추가" 인라인 폼 (등급명 + 가격 필수).
 *  - 본문: TicketTierRow 리스트, 빈 상태 안내, 낙관적 add/remove/reorder.
 *
 * 낙관적 업데이트 (useSectionList):
 *  - add: 임시 음수 id 로 즉시 삽입 → 서버 응답 받으면 replace(임시→실제 row)
 *  - remove: 즉시 제거 → 실패 시 rollback (이전 items 로 reset)
 *  - reorder: keys 순서 즉시 적용 → 실패 시 이전 items 로 rollback
 */

import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSectionList } from "@/lib/admin/section-state";

import { TicketTierRow, type TicketTierRowValue } from "./TicketTierRow";

import {
  createTicketTierAction,
  deleteTicketTierAction,
  reorderTicketTiersAction,
  updateTicketTierAction,
} from "../ticket-tier-actions";

export interface TicketTiersSubSectionProps {
  formatId: number;
  initialTiers: TicketTierRowValue[];
}

let tempIdCounter = -1;
function nextTempId(): number {
  tempIdCounter -= 1;
  return tempIdCounter;
}

export function TicketTiersSubSection({
  formatId,
  initialTiers,
}: TicketTiersSubSectionProps) {
  const list = useSectionList<TicketTierRowValue>(
    initialTiers,
    (t) => t.id
  );

  const [creatingName, setCreatingName] = useState("");
  const [creatingPrice, setCreatingPrice] = useState("");
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 진행 중 reorder rollback 용 snapshot.
  const previousRef = useRef<TicketTierRowValue[] | null>(null);

  const items = list.items;

  const handleCreate = useCallback(async () => {
    const name = creatingName.trim();
    const priceRaw = creatingPrice.trim();
    if (!name) {
      setCreatingError("등급명을 입력해주세요.");
      return;
    }
    const priceJpy = priceRaw === "" ? NaN : Number(priceRaw);
    if (!Number.isInteger(priceJpy) || priceJpy < 0) {
      setCreatingError("가격은 0 이상의 정수여야 합니다.");
      return;
    }
    setCreatingError(null);

    // 낙관적 추가.
    const tempId = nextTempId();
    const optimistic: TicketTierRowValue = {
      id: tempId,
      name,
      priceJpy,
      order: items.length,
      notes: null,
    };
    list.add(optimistic);

    const result = await createTicketTierAction(formatId, {
      name,
      priceJpy,
      order: items.length,
    });

    if (!result.ok || !result.tier) {
      // rollback.
      list.remove(tempId);
      setCreatingError(result.ok ? "티어 생성에 실패했습니다." : result.error ?? "티어 생성에 실패했습니다.");
      return;
    }

    // 임시 id 를 실제 row 로 교체.
    list.replace(tempId, {
      id: result.tier.id,
      name: result.tier.name,
      priceJpy: result.tier.priceJpy,
      order: result.tier.order,
      notes: result.tier.notes,
    });
    setCreatingName("");
    setCreatingPrice("");
  }, [creatingName, creatingPrice, formatId, items.length, list]);

  const handleDelete = useCallback(
    async (tierId: number) => {
      const snapshot = items;
      list.remove(tierId);
      const result = await deleteTicketTierAction(tierId);
      if (!result.ok) {
        // rollback.
        list.reset(snapshot);
      }
    },
    [items, list]
  );

  const handleUpdate = useCallback(
    async (
      tierId: number,
      patch: Partial<{
        name: string;
        priceJpy: number;
        order: number;
        notes: string;
      }>
    ) => {
      const result = await updateTicketTierAction(tierId, patch);
      if (result.ok && result.tier) {
        // server truth 로 (조용히) 동기화.
        list.replace(tierId, {
          id: result.tier.id,
          name: result.tier.name,
          priceJpy: result.tier.priceJpy,
          order: result.tier.order,
          notes: result.tier.notes,
        });
      }
      return result;
    },
    [list]
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const snapshot = items;
      const reordered = [...items];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      const orderedIds = reordered.map((t) => t.id);

      previousRef.current = snapshot;
      list.reorder(orderedIds);

      // 임시(음수) id 가 포함된 경우 서버 호출 보류 — 실제 row 만 정렬 가능.
      if (orderedIds.some((id) => id < 0)) {
        return;
      }

      startTransition(async () => {
        const result = await reorderTicketTiersAction(formatId, orderedIds);
        if (!result.ok && previousRef.current) {
          list.reset(previousRef.current);
        }
        previousRef.current = null;
      });
    },
    [formatId, items, list]
  );

  const hasItems = items.length > 0;

  const headerLabelId = useMemo(
    () => `tier-section-${formatId}`,
    [formatId]
  );

  return (
    <section
      aria-labelledby={headerLabelId}
      className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 p-4"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id={headerLabelId} className="text-sm font-semibold">
            티켓 티어
          </h3>
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            좌석/등급별 가격을 등록하세요.
          </p>
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`new-tier-name-${formatId}`}
              className="text-[11px] font-medium text-[color:var(--color-muted-foreground)]"
            >
              등급명
            </label>
            <Input
              id={`new-tier-name-${formatId}`}
              name="newTierName"
              value={creatingName}
              placeholder="S석 지정"
              onChange={(e) => setCreatingName(e.target.value)}
              className="sm:w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`new-tier-price-${formatId}`}
              className="text-[11px] font-medium text-[color:var(--color-muted-foreground)]"
            >
              가격(JPY)
            </label>
            <Input
              id={`new-tier-price-${formatId}`}
              name="newTierPrice"
              type="number"
              min={0}
              step={1}
              value={creatingPrice}
              placeholder="9800"
              onChange={(e) => setCreatingPrice(e.target.value)}
              className="sm:w-32"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCreate}
          >
            + 티어 추가
          </Button>
        </div>
      </header>

      {creatingError ? (
        <p className="mb-3 text-xs text-[color:var(--color-destructive)]">
          {creatingError}
        </p>
      ) : null}

      {hasItems ? (
        <ul className="flex flex-col gap-3">
          {items.map((tier, index) => (
            <li key={tier.id}>
              <TicketTierRow
                tier={tier}
                index={index}
                total={items.length}
                onUpdate={(patch) => handleUpdate(tier.id, patch)}
                onMoveUp={() => handleMove(index, -1)}
                onMoveDown={() => handleMove(index, 1)}
                onDelete={() => handleDelete(tier.id)}
                disabled={tier.id < 0}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-[color:var(--color-muted-foreground)]">
          이 포맷에 티어가 아직 없습니다. 추가하세요.
        </p>
      )}
    </section>
  );
}
