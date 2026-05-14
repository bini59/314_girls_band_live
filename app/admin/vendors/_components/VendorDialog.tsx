"use client";

/**
 * VendorDialog — 발매처 생성/편집 모달.
 *
 * - mode: "create" | "edit"
 * - 필드: slug (kebab-case), name, baseUrl (optional), logoUrl (optional), notes (optional textarea).
 * - 클라이언트 측 Zod 검증으로 즉시 피드백을 주되, 서버에서 다시 검증한다.
 * - 제출 중에는 버튼/입력 비활성화.
 * - 서버 측 fieldErrors / error 를 prop 으로 받아 표시.
 */

import * as React from "react";

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
import { Textarea } from "@/components/ui/textarea";

import {
  vendorCreateSchema,
  vendorUpdateSchema,
} from "@/lib/admin/schemas/vendor";

export type VendorDialogValues = {
  slug: string;
  name: string;
  baseUrl: string;
  logoUrl: string;
  notes: string;
};

export type VendorDialogInitial = Partial<VendorDialogValues> & {
  id?: number;
};

export interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: VendorDialogInitial;
  /**
   * 제출 핸들러 — 부모(VendorsTable)가 Server Action 호출을 책임진다.
   * 반환된 결과로 fieldErrors/error 를 다이얼로그에 다시 노출.
   */
  onSubmit: (
    values: VendorDialogValues
  ) => Promise<
    | { ok: true }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  >;
}

const EMPTY_VALUES: VendorDialogValues = {
  slug: "",
  name: "",
  baseUrl: "",
  logoUrl: "",
  notes: "",
};

export function VendorDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: VendorDialogProps) {
  const [values, setValues] =
    React.useState<VendorDialogValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // open 으로 변할 때 initial 로 폼 동기화.
  React.useEffect(() => {
    if (!open) return;
    setValues({
      slug: initial?.slug ?? "",
      name: initial?.name ?? "",
      baseUrl: initial?.baseUrl ?? "",
      logoUrl: initial?.logoUrl ?? "",
      notes: initial?.notes ?? "",
    });
    setFieldErrors({});
    setTopError(null);
    setPending(false);
  }, [open, initial]);

  function update<K extends keyof VendorDialogValues>(
    key: K,
    value: VendorDialogValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    // 클라이언트 측 사전 검증 — UX 즉시 피드백.
    const schema = mode === "create" ? vendorCreateSchema : vendorUpdateSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >);
      return;
    }

    setPending(true);
    try {
      const result = await onSubmit(values);
      if (result.ok) {
        onOpenChange(false);
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      if (result.error) {
        setTopError(result.error);
      }
    } catch (err) {
      console.error("[VendorDialog] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "create" ? "판매처 추가" : "판매처 편집";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              발매처(e+, 로손, FC 공식 등) 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <Field
            id="vendor-slug"
            label="slug"
            error={fieldErrors.slug?.[0]}
            hint="소문자/숫자/하이픈만 (예: ee-plus)"
          >
            <Input
              id="vendor-slug"
              name="slug"
              value={values.slug}
              onChange={(e) => update("slug", e.target.value)}
              disabled={pending}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="vendor-name"
            label="표시 이름"
            error={fieldErrors.name?.[0]}
          >
            <Input
              id="vendor-name"
              name="name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="vendor-baseUrl"
            label="기본 URL (선택)"
            error={fieldErrors.baseUrl?.[0]}
          >
            <Input
              id="vendor-baseUrl"
              name="baseUrl"
              type="url"
              value={values.baseUrl}
              onChange={(e) => update("baseUrl", e.target.value)}
              disabled={pending}
              placeholder="https://eplus.jp"
            />
          </Field>

          <Field
            id="vendor-logoUrl"
            label="로고 URL (선택)"
            error={fieldErrors.logoUrl?.[0]}
          >
            <Input
              id="vendor-logoUrl"
              name="logoUrl"
              type="url"
              value={values.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              disabled={pending}
            />
          </Field>

          <Field
            id="vendor-notes"
            label="메모 (선택)"
            error={fieldErrors.notes?.[0]}
          >
            <Textarea
              id="vendor-notes"
              name="notes"
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              disabled={pending}
              rows={3}
            />
          </Field>

          {topError ? (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-destructive)]"
            >
              {topError}
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
            <Button type="submit" disabled={pending}>
              {pending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
