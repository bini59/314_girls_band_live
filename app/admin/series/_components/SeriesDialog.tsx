"use client";

/**
 * SeriesDialog — 시리즈 생성/편집 모달.
 *
 *  - mode: "create" | "edit"
 *  - 필수 필드: slug (kebab-case), nameKo, nameJp.
 *  - 옵셔널: nameEn, logoUrl, description.
 *  - 클라이언트 측 Zod 사전 검증 (UX 즉시 피드백) + 서버 측 fieldErrors 표시.
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
  seriesCreateSchema,
  seriesUpdateSchema,
} from "@/lib/admin/schemas/series";

export type SeriesDialogValues = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  logoUrl: string;
  description: string;
};

export type SeriesDialogInitial = Partial<SeriesDialogValues> & {
  id?: number;
};

export interface SeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: SeriesDialogInitial;
  onSubmit: (
    values: SeriesDialogValues
  ) => Promise<
    | { ok: true }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  >;
}

const EMPTY_VALUES: SeriesDialogValues = {
  slug: "",
  nameKo: "",
  nameJp: "",
  nameEn: "",
  logoUrl: "",
  description: "",
};

export function SeriesDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: SeriesDialogProps) {
  const [values, setValues] =
    React.useState<SeriesDialogValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      slug: initial?.slug ?? "",
      nameKo: initial?.nameKo ?? "",
      nameJp: initial?.nameJp ?? "",
      nameEn: initial?.nameEn ?? "",
      logoUrl: initial?.logoUrl ?? "",
      description: initial?.description ?? "",
    });
    setFieldErrors({});
    setTopError(null);
    setPending(false);
  }, [open, initial]);

  function update<K extends keyof SeriesDialogValues>(
    key: K,
    value: SeriesDialogValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const schema = mode === "create" ? seriesCreateSchema : seriesUpdateSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
      return;
    }

    setPending(true);
    try {
      const result = await onSubmit(values);
      if (result.ok) {
        onOpenChange(false);
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setTopError(result.error);
    } catch (err) {
      console.error("[SeriesDialog] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "create" ? "시리즈 추가" : "시리즈 편집";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              시리즈/IP (러브라이브, 아이마스 등) 마스터 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <Field
            id="series-slug"
            label="slug"
            error={fieldErrors.slug?.[0]}
            hint="소문자/숫자/하이픈만 (예: love-live)"
          >
            <Input
              id="series-slug"
              name="slug"
              value={values.slug}
              onChange={(e) => update("slug", e.target.value)}
              disabled={pending}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="series-nameKo"
            label="한국어 이름"
            error={fieldErrors.nameKo?.[0]}
          >
            <Input
              id="series-nameKo"
              name="nameKo"
              value={values.nameKo}
              onChange={(e) => update("nameKo", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="series-nameJp"
            label="일본어 이름"
            error={fieldErrors.nameJp?.[0]}
          >
            <Input
              id="series-nameJp"
              name="nameJp"
              value={values.nameJp}
              onChange={(e) => update("nameJp", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="series-nameEn"
            label="영어 이름 (선택)"
            error={fieldErrors.nameEn?.[0]}
          >
            <Input
              id="series-nameEn"
              name="nameEn"
              value={values.nameEn}
              onChange={(e) => update("nameEn", e.target.value)}
              disabled={pending}
            />
          </Field>

          <Field
            id="series-logoUrl"
            label="로고 URL (선택)"
            error={fieldErrors.logoUrl?.[0]}
          >
            <Input
              id="series-logoUrl"
              name="logoUrl"
              type="url"
              value={values.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              disabled={pending}
              placeholder="https://..."
            />
          </Field>

          <Field
            id="series-description"
            label="설명 (선택)"
            error={fieldErrors.description?.[0]}
          >
            <Textarea
              id="series-description"
              name="description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
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
