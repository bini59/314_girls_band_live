/**
 * LiveFormatDialog — LiveFormat 생성/편집 모달.
 *
 * - type select (현지 공연 / 라이브뷰잉 / 배포)
 * - label / venueName / url 입력. type 에 따라 placeholder 변동.
 * - submit 직전에 Zod 로 validate 후, 부모가 넘긴 onSubmit (Server Action wrapper) 호출.
 * - onSubmit 결과의 fieldErrors 를 받아 inline 에 표시.
 * - dialog 가 열릴 때마다 form 상태를 initial 또는 빈값으로 reset.
 */
"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  liveFormatCreateSchema,
  liveFormatTypeSchema,
} from "@/lib/admin/schemas/live-format";

import type { LiveFormatActionResult } from "../live-format-actions";

/** Prisma LiveFormatType 과 동일. import 회피 위해 별도 정의. */
export type LiveFormatTypeValue = "LIVE_VENUE" | "LIVE_VIEWING" | "STREAMING";

/** 단일 티어 row (TicketTiersSubSection 이 받는 모양과 동일). */
export interface LiveFormatTierLike {
  id: number;
  name: string;
  priceJpy: number;
  order: number;
  notes: string | null;
}

/** 입력 가능한 형태 (DB row 가 아니어도 됨). */
export interface LiveFormatLike {
  id?: number;
  type: LiveFormatTypeValue;
  label: string | null;
  venueName: string | null;
  url: string | null;
  /** 카드 내부 nested 렌더용. 신규(create) 시점에는 빈 배열. */
  tiers?: LiveFormatTierLike[];
}

export interface LiveFormatDialogValues {
  type: LiveFormatTypeValue;
  label: string;
  venueName: string;
  url: string;
}

export interface LiveFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: LiveFormatLike;
  onSubmit: (values: LiveFormatDialogValues) => Promise<LiveFormatActionResult>;
}

/** 한국어 라벨 — UX_DECISIONS 톤. */
const TYPE_LABEL: Record<LiveFormatTypeValue, string> = {
  LIVE_VENUE: "현지 공연",
  LIVE_VIEWING: "라이브뷰잉",
  STREAMING: "배포",
};

const TYPE_OPTIONS: LiveFormatTypeValue[] = [
  "LIVE_VENUE",
  "LIVE_VIEWING",
  "STREAMING",
];

function venueNamePlaceholder(type: LiveFormatTypeValue): string {
  if (type === "LIVE_VIEWING") return "전국 5관 LV";
  if (type === "STREAMING") return "(URL 만 필요)";
  return "さいたまスーパーアリーナ";
}

function emptyValues(initial?: LiveFormatLike): LiveFormatDialogValues {
  return {
    type: initial?.type ?? "LIVE_VENUE",
    label: initial?.label ?? "",
    venueName: initial?.venueName ?? "",
    url: initial?.url ?? "",
  };
}

export function LiveFormatDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: LiveFormatDialogProps) {
  const [values, setValues] = React.useState<LiveFormatDialogValues>(() =>
    emptyValues(initial)
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // open=true 로 전환될 때마다 폼 상태를 reset (재오픈 시 잔존값 방지).
  React.useEffect(() => {
    if (open) {
      setValues(emptyValues(initial));
      setFieldErrors({});
      setGlobalError(null);
      setSubmitting(false);
    }
  }, [open, initial]);

  function setField<K extends keyof LiveFormatDialogValues>(
    key: K,
    next: LiveFormatDialogValues[K]
  ): void {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    setGlobalError(null);

    // 클라이언트 사전 검증 — 서버에서 어차피 재검증되지만 UX 즉시 응답.
    const typeParsed = liveFormatTypeSchema.safeParse(values.type);
    if (!typeParsed.success) {
      setFieldErrors({ type: ["올바른 타입을 선택해주세요."] });
      return;
    }
    const parsed = liveFormatCreateSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    let result: LiveFormatActionResult;
    try {
      result = await onSubmit(values);
    } catch (err) {
      console.error("[LiveFormatDialog:onSubmit]", err);
      setGlobalError("저장에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    if (result.ok) {
      setSubmitting(false);
      onOpenChange(false);
      return;
    }

    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
    if (result.error) {
      setGlobalError(result.error);
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "포맷 추가" : "포맷 편집"}
          </DialogTitle>
          <DialogDescription>
            현지 공연 · 라이브뷰잉 · 배포 중 하나를 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} aria-label="live-format-form">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="lf-type"
                className="text-sm font-medium text-[color:var(--color-foreground)]"
              >
                타입
              </label>
              <Select
                id="lf-type"
                name="type"
                value={values.type}
                onChange={(e) =>
                  setField("type", e.target.value as LiveFormatTypeValue)
                }
                disabled={submitting}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {TYPE_LABEL[opt]}
                  </option>
                ))}
              </Select>
              {fieldErrors.type ? (
                <p className="text-xs text-[color:var(--color-destructive)]">
                  {fieldErrors.type.join(" ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="lf-label"
                className="text-sm font-medium text-[color:var(--color-foreground)]"
              >
                라벨 (선택)
              </label>
              <Input
                id="lf-label"
                name="label"
                value={values.label}
                onChange={(e) => setField("label", e.target.value)}
                placeholder="예: 전국 5관 LV"
                disabled={submitting}
              />
              {fieldErrors.label ? (
                <p className="text-xs text-[color:var(--color-destructive)]">
                  {fieldErrors.label.join(" ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="lf-venueName"
                className="text-sm font-medium text-[color:var(--color-foreground)]"
              >
                회장명 (선택)
              </label>
              <Input
                id="lf-venueName"
                name="venueName"
                value={values.venueName}
                onChange={(e) => setField("venueName", e.target.value)}
                placeholder={venueNamePlaceholder(values.type)}
                disabled={submitting}
              />
              {fieldErrors.venueName ? (
                <p className="text-xs text-[color:var(--color-destructive)]">
                  {fieldErrors.venueName.join(" ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="lf-url"
                className="text-sm font-medium text-[color:var(--color-foreground)]"
              >
                URL (선택)
              </label>
              <Input
                id="lf-url"
                name="url"
                type="url"
                value={values.url}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://..."
                disabled={submitting}
              />
              {fieldErrors.url ? (
                <p className="text-xs text-[color:var(--color-destructive)]">
                  {fieldErrors.url.join(" ")}
                </p>
              ) : null}
            </div>

            {globalError ? (
              <p
                role="alert"
                className="text-sm text-[color:var(--color-destructive)]"
              >
                {globalError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : mode === "create" ? "추가" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
