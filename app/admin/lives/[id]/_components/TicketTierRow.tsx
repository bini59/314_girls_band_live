"use client";

/**
 * TicketTierRow — 단일 티켓 티어 인라인 편집 행.
 *
 * - 필드: name (text), priceJpy (number, min=0), notes (textarea)
 * - 변경 시 createAutoSaveController(debounce 800ms) 로 자동저장 → onUpdate(patch)
 * - 자동저장 상태 (idle/dirty/saving/saved/error) 는 AutoSaveIndicator 로 표시
 * - 행 우측: ↑/↓ 이동 버튼 + 삭제 버튼
 * - 필드 에러는 인라인으로 표시 (server fieldErrors 매핑)
 */

import { useEffect, useMemo, useState } from "react";

import {
  createAutoSaveController,
  type AutoSaveState,
} from "@/lib/admin/auto-save";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { AutoSaveIndicator } from "./AutoSaveIndicator";

import type { TicketTierActionResult } from "../ticket-tier-actions";

export type TicketTierRowValue = {
  id: number;
  name: string;
  priceJpy: number;
  order: number;
  notes: string | null;
};

export type TicketTierPatch = Partial<{
  name: string;
  priceJpy: number;
  order: number;
  notes: string;
}>;

export interface TicketTierRowProps {
  tier: TicketTierRowValue;
  index: number;
  total: number;
  onUpdate: (patch: TicketTierPatch) => Promise<TicketTierActionResult>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}

export function TicketTierRow({
  tier,
  index,
  total,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  disabled = false,
}: TicketTierRowProps) {
  const initial = useMemo(
    () => ({
      name: tier.name,
      priceJpy: tier.priceJpy,
      notes: tier.notes ?? "",
    }),
    [tier.id]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  const [form, setForm] = useState(initial);
  const [saveState, setSaveState] = useState<AutoSaveState<TicketTierPatch>>({
    status: "idle",
    lastSavedAt: null,
    error: null,
    pending: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [deleting, setDeleting] = useState(false);

  // 컨트롤러는 mount 시 1회 생성.
  const [controller] = useState(() =>
    createAutoSaveController<TicketTierPatch>({
      debounceMs: 800,
      save: async (patch) => {
        const result = await onUpdate(patch);
        if (result.ok) {
          setFieldErrors({});
          return { ok: true, savedAt: result.savedAt };
        }
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return { ok: false, error: result.error ?? "저장 실패" };
      },
    })
  );

  useEffect(() => {
    const unsub = controller.subscribe((s) => setSaveState({ ...s }));
    return () => {
      unsub();
      controller.dispose();
    };
  }, [controller]);

  function submitPatch(patch: TicketTierPatch): void {
    controller.submit(patch);
  }

  const nameId = `tier-${tier.id}-name`;
  const priceId = `tier-${tier.id}-price`;
  const notesId = `tier-${tier.id}-notes`;

  return (
    <div
      data-tier-id={tier.id}
      className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-[color:var(--color-muted-foreground)]">
          티어 #{index + 1}
        </div>
        <div className="flex items-center gap-2">
          <AutoSaveIndicator
            status={saveState.status}
            lastSavedAt={saveState.lastSavedAt}
            onRetry={() => controller.retry()}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="위로 이동"
            disabled={disabled || index === 0}
            onClick={onMoveUp}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="아래로 이동"
            disabled={disabled || index >= total - 1}
            onClick={onMoveDown}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={disabled || deleting}
            onClick={async () => {
              if (deleting) return;
              setDeleting(true);
              try {
                await onDelete();
              } finally {
                setDeleting(false);
              }
            }}
          >
            삭제
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-xs font-medium">
            등급명
          </label>
          <Input
            id={nameId}
            name="name"
            value={form.name}
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({ ...prev, name: value }));
              submitPatch({ name: value });
            }}
          />
          {fieldErrors.name?.[0] ? (
            <p className="text-xs text-[color:var(--color-destructive)]">
              {fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={priceId} className="text-xs font-medium">
            가격 (JPY)
          </label>
          <Input
            id={priceId}
            name="priceJpy"
            type="number"
            min={0}
            step={1}
            value={String(form.priceJpy)}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value;
              // 빈 값은 0 으로 normalise (스키마는 number 만 받음).
              const next = raw === "" ? 0 : Number(raw);
              setForm((prev) => ({ ...prev, priceJpy: next }));
              if (!Number.isNaN(next)) {
                submitPatch({ priceJpy: next });
              }
            }}
          />
          {fieldErrors.priceJpy?.[0] ? (
            <p className="text-xs text-[color:var(--color-destructive)]">
              {fieldErrors.priceJpy[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor={notesId} className="text-xs font-medium">
          비고
        </label>
        <Textarea
          id={notesId}
          name="notes"
          value={form.notes}
          rows={2}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value;
            setForm((prev) => ({ ...prev, notes: value }));
            submitPatch({ notes: value });
          }}
        />
        {fieldErrors.notes?.[0] ? (
          <p className="text-xs text-[color:var(--color-destructive)]">
            {fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
