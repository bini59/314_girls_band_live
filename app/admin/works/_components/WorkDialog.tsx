"use client";

/**
 * WorkDialog — 작품 생성/편집 모달.
 *
 *  - mode: "create" | "edit"
 *  - 필수: slug, nameKo, nameJp.
 *  - 옵셔널: nameEn, kind, logoUrl, description, seriesId.
 *  - seriesId 셀렉트는 props `series` 로 전달받음. "시리즈 없음" 옵션 제공.
 *  - 클라이언트 측 Zod 사전 검증 + 서버 측 fieldErrors 표시.
 */

import * as React from "react";
import type { Series } from "@prisma/client";

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

import { workCreateSchema, workUpdateSchema } from "@/lib/admin/schemas/work";

export type WorkDialogValues = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  kind: string;
  logoUrl: string;
  description: string;
  seriesId: number | null;
};

export type WorkDialogInitial = Partial<WorkDialogValues> & {
  id?: number;
};

export interface WorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: WorkDialogInitial;
  series: Series[];
  onSubmit: (
    values: WorkDialogValues
  ) => Promise<
    | { ok: true }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  >;
}

const EMPTY_VALUES: WorkDialogValues = {
  slug: "",
  nameKo: "",
  nameJp: "",
  nameEn: "",
  kind: "",
  logoUrl: "",
  description: "",
  seriesId: null,
};

const NULL_SERIES_VALUE = "__null__";

export function WorkDialog({
  open,
  onOpenChange,
  mode,
  initial,
  series,
  onSubmit,
}: WorkDialogProps) {
  const [values, setValues] = React.useState<WorkDialogValues>(EMPTY_VALUES);
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
      kind: initial?.kind ?? "",
      logoUrl: initial?.logoUrl ?? "",
      description: initial?.description ?? "",
      seriesId: initial?.seriesId ?? null,
    });
    setFieldErrors({});
    setTopError(null);
    setPending(false);
  }, [open, initial]);

  function update<K extends keyof WorkDialogValues>(
    key: K,
    value: WorkDialogValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const schema = mode === "create" ? workCreateSchema : workUpdateSchema;
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
      console.error("[WorkDialog] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "create" ? "작품 추가" : "작품 편집";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              작품(러브라이브!, 뱅드림, 걸즈밴드 크라이 등) 마스터 정보를
              입력합니다.
            </DialogDescription>
          </DialogHeader>

          <Field
            id="work-slug"
            label="slug"
            error={fieldErrors.slug?.[0]}
            hint="소문자/숫자/하이픈만 (예: love-live)"
          >
            <Input
              id="work-slug"
              name="slug"
              value={values.slug}
              onChange={(e) => update("slug", e.target.value)}
              disabled={pending}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="work-series"
            label="시리즈 (선택)"
            error={fieldErrors.seriesId?.[0]}
            hint="시리즈/IP 묶음이 있다면 선택. 단일 작품 IP 는 '시리즈 없음'."
          >
            <select
              id="work-series"
              name="seriesId"
              value={values.seriesId === null ? NULL_SERIES_VALUE : String(values.seriesId)}
              onChange={(e) =>
                update(
                  "seriesId",
                  e.target.value === NULL_SERIES_VALUE
                    ? null
                    : Number(e.target.value)
                )
              }
              disabled={pending}
              className="flex h-9 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]"
            >
              <option value={NULL_SERIES_VALUE}>— 시리즈 없음 —</option>
              {series.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nameKo} ({s.nameJp})
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="work-nameKo"
            label="한국어 이름"
            error={fieldErrors.nameKo?.[0]}
          >
            <Input
              id="work-nameKo"
              name="nameKo"
              value={values.nameKo}
              onChange={(e) => update("nameKo", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="work-nameJp"
            label="일본어 이름"
            error={fieldErrors.nameJp?.[0]}
          >
            <Input
              id="work-nameJp"
              name="nameJp"
              value={values.nameJp}
              onChange={(e) => update("nameJp", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="work-nameEn"
            label="영어 이름 (선택)"
            error={fieldErrors.nameEn?.[0]}
          >
            <Input
              id="work-nameEn"
              name="nameEn"
              value={values.nameEn}
              onChange={(e) => update("nameEn", e.target.value)}
              disabled={pending}
            />
          </Field>

          <Field
            id="work-kind"
            label="종류 (선택)"
            error={fieldErrors.kind?.[0]}
            hint="anime / game / media_mix 등 자유 텍스트"
          >
            <Input
              id="work-kind"
              name="kind"
              value={values.kind}
              onChange={(e) => update("kind", e.target.value)}
              disabled={pending}
              placeholder="anime"
            />
          </Field>

          <Field
            id="work-logoUrl"
            label="로고 URL (선택)"
            error={fieldErrors.logoUrl?.[0]}
          >
            <Input
              id="work-logoUrl"
              name="logoUrl"
              type="url"
              value={values.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              disabled={pending}
              placeholder="https://..."
            />
          </Field>

          <Field
            id="work-description"
            label="설명 (선택)"
            error={fieldErrors.description?.[0]}
          >
            <Textarea
              id="work-description"
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
