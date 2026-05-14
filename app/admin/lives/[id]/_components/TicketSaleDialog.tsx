"use client";

/**
 * TicketSaleDialog — 판매 라운드 등록/편집 모달.
 *
 * - mode="create": 빈 폼.
 * - mode="edit": initial 값으로 채움.
 * - 제출 시 Zod 검증은 서버 액션이 수행. fieldErrors 가 반환되면 필드별 표시.
 * - 발매처(vendors) 가 없으면 폼 비활성화 + 안내.
 *
 * 컨벤션:
 *  - JST datetime-local 입력 (서버에서 UTC 변환).
 *  - 한국어 라벨/메시지.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { TicketSaleActionResult, TicketSaleFormInput } from "../ticket-sale-actions";

import {
  TICKET_SALE_METHOD_OPTIONS,
  TICKET_SALE_TYPE_OPTIONS,
} from "./ticket-sale-labels";
import { TierMultiSelect, type TierMultiSelectFormat } from "./TierMultiSelect";

export interface TicketSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: TicketSaleFormInput;
  vendors: Array<{ id: number; name: string }>;
  formats: TierMultiSelectFormat[];
  onSubmit: (values: TicketSaleFormInput) => Promise<TicketSaleActionResult>;
}

const EMPTY: TicketSaleFormInput = {
  vendorId: undefined,
  type: "FC_SENKO",
  method: "LOTTERY",
  label: "",
  startsAtJst: "",
  endsAtJst: "",
  announceAtJst: "",
  paymentDeadlineAtJst: "",
  url: "",
  notes: "",
  tierIds: [],
};

export function TicketSaleDialog({
  open,
  onOpenChange,
  mode,
  initial,
  vendors,
  formats,
  onSubmit,
}: TicketSaleDialogProps): React.JSX.Element {
  const [values, setValues] = useState<TicketSaleFormInput>(() => ({
    ...EMPTY,
    ...(initial ?? {}),
    // vendorId 초기값 — initial 없으면 vendors 의 첫 항목 (있을 때만).
    vendorId:
      initial?.vendorId !== undefined
        ? initial.vendorId
        : vendors[0]?.id,
    tierIds: initial?.tierIds ?? [],
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // open 토글 시 폼 리셋.
  useEffect(() => {
    if (open) {
      setValues({
        ...EMPTY,
        ...(initial ?? {}),
        vendorId:
          initial?.vendorId !== undefined ? initial.vendorId : vendors[0]?.id,
        tierIds: initial?.tierIds ?? [],
      });
      setFieldErrors({});
      setGlobalError(null);
      setPending(false);
    }
  }, [open, initial, vendors]);

  const vendorsEmpty = vendors.length === 0;
  // 폼 전체 disabled 조건: 제출중 또는 vendor 없음 (create 모드 한정).
  const disabled = pending || (vendorsEmpty && mode === "create");

  function patch<K extends keyof TicketSaleFormInput>(
    key: K,
    value: TicketSaleFormInput[K]
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    if (disabled) return;
    setPending(true);
    setGlobalError(null);
    setFieldErrors({});

    const result = await onSubmit(values);
    setPending(false);

    if (result.ok) {
      onOpenChange(false);
      return;
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
    if (result.error) {
      setGlobalError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "라운드 추가" : "라운드 편집"}
          </DialogTitle>
          <DialogDescription>
            발매처, 유형, 일정, 그리고 적용 티어를 선택합니다. (시각은 JST)
          </DialogDescription>
        </DialogHeader>

        {vendorsEmpty && mode === "create" ? (
          <div
            role="alert"
            data-testid="vendors-empty-notice"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 p-3 text-sm text-[color:var(--color-destructive)]"
          >
            /admin/vendors 에서 발매처를 먼저 등록해주세요.
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          aria-busy={pending}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
        >
          {/* vendor + type + method */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="vendorId">
                발매처 <span className="text-[color:var(--color-destructive)]">*</span>
              </Label>
              <Select
                id="vendorId"
                name="vendorId"
                value={values.vendorId !== undefined ? String(values.vendorId) : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patch("vendorId", Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                disabled={disabled || vendorsEmpty}
                aria-invalid={!!fieldErrors.vendorId}
              >
                {!values.vendorId ? <option value="">선택</option> : null}
                {vendors.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <FieldError messages={fieldErrors.vendorId} />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="type">
                유형 <span className="text-[color:var(--color-destructive)]">*</span>
              </Label>
              <Select
                id="type"
                name="type"
                value={values.type ?? "FC_SENKO"}
                onChange={(e) =>
                  patch(
                    "type",
                    e.target.value as TicketSaleFormInput["type"]
                  )
                }
                disabled={disabled}
                aria-invalid={!!fieldErrors.type}
              >
                {TICKET_SALE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <FieldError messages={fieldErrors.type} />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="method">
                방식 <span className="text-[color:var(--color-destructive)]">*</span>
              </Label>
              <Select
                id="method"
                name="method"
                value={values.method ?? "LOTTERY"}
                onChange={(e) =>
                  patch(
                    "method",
                    e.target.value as TicketSaleFormInput["method"]
                  )
                }
                disabled={disabled}
                aria-invalid={!!fieldErrors.method}
              >
                {TICKET_SALE_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <FieldError messages={fieldErrors.method} />
            </div>
          </div>

          {/* label */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="label">라벨</Label>
            <Input
              id="label"
              name="label"
              value={values.label ?? ""}
              onChange={(e) => patch("label", e.target.value)}
              placeholder="MyGO!!!!! FC 最速先行"
              disabled={disabled}
              aria-invalid={!!fieldErrors.label}
            />
            <FieldError messages={fieldErrors.label} />
          </div>

          {/* dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="startsAtJst">
                시작 (JST){" "}
                <span className="text-[color:var(--color-destructive)]">*</span>
              </Label>
              <Input
                id="startsAtJst"
                name="startsAtJst"
                type="datetime-local"
                value={values.startsAtJst ?? ""}
                onChange={(e) => patch("startsAtJst", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.startsAtJst}
              />
              <FieldError messages={fieldErrors.startsAtJst} />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="endsAtJst">마감 (JST)</Label>
              <Input
                id="endsAtJst"
                name="endsAtJst"
                type="datetime-local"
                value={values.endsAtJst ?? ""}
                onChange={(e) => patch("endsAtJst", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.endsAtJst}
              />
              <FieldError messages={fieldErrors.endsAtJst} />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="announceAtJst">발표 (JST)</Label>
              <Input
                id="announceAtJst"
                name="announceAtJst"
                type="datetime-local"
                value={values.announceAtJst ?? ""}
                onChange={(e) => patch("announceAtJst", e.target.value)}
                disabled={disabled}
                aria-invalid={!!fieldErrors.announceAtJst}
              />
              <FieldError messages={fieldErrors.announceAtJst} />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="paymentDeadlineAtJst">입금 기한 (JST)</Label>
              <Input
                id="paymentDeadlineAtJst"
                name="paymentDeadlineAtJst"
                type="datetime-local"
                value={values.paymentDeadlineAtJst ?? ""}
                onChange={(e) =>
                  patch("paymentDeadlineAtJst", e.target.value)
                }
                disabled={disabled}
                aria-invalid={!!fieldErrors.paymentDeadlineAtJst}
              />
              <FieldError messages={fieldErrors.paymentDeadlineAtJst} />
            </div>
          </div>

          {/* url */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              value={values.url ?? ""}
              onChange={(e) => patch("url", e.target.value)}
              placeholder="https://eplus.jp/..."
              disabled={disabled}
              aria-invalid={!!fieldErrors.url}
            />
            <FieldError messages={fieldErrors.url} />
          </div>

          {/* notes */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="notes">노트</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              value={values.notes ?? ""}
              onChange={(e) => patch("notes", e.target.value)}
              disabled={disabled}
              aria-invalid={!!fieldErrors.notes}
            />
            <FieldError messages={fieldErrors.notes} />
          </div>

          {/* tier 매핑 */}
          <div className="flex flex-col gap-1">
            <Label>적용 티어</Label>
            <TierMultiSelect
              formats={formats}
              selectedTierIds={values.tierIds ?? []}
              onChange={(next) => patch("tierIds", next)}
              disabled={disabled}
            />
            <FieldError messages={fieldErrors.tierIds} />
          </div>

          {globalError ? (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-destructive)]"
            >
              {globalError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={disabled}>
              {pending ? "저장 중..." : mode === "create" ? "추가" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }): React.JSX.Element | null {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-xs text-[color:var(--color-destructive)]">
      {messages[0]}
    </p>
  );
}
