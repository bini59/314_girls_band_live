"use client";

/**
 * WorkForm — 작품 생성/편집 페이지 폼.
 *
 *  - mode: "create" | "edit"
 *  - 필수: slug, nameKo, nameJp.
 *  - 옵셔널: nameEn, kind, logoUrl, description, seriesId.
 *  - 클라이언트 측 Zod 사전 검증 + 서버 측 fieldErrors 표시.
 *  - 저장 성공 시 /admin/works 로 이동.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Series } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThumbnailField } from "@/components/admin/ThumbnailField";

import { workCreateSchema, workUpdateSchema } from "@/lib/admin/schemas/work";

import { createWorkAction, updateWorkAction } from "../actions";

export type WorkFormValues = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  kind: string;
  logoUrl: string;
  description: string;
  seriesId: number | null;
};

export type WorkFormInitial = Partial<WorkFormValues> & { id?: number };

export interface WorkFormProps {
  mode: "create" | "edit";
  workId?: number;
  initial?: WorkFormInitial;
  series: Series[];
}

const EMPTY_VALUES: WorkFormValues = {
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

export function WorkForm({ mode, workId, initial, series }: WorkFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<WorkFormValues>(() => ({
    ...EMPTY_VALUES,
    ...initial,
    seriesId: initial?.seriesId ?? null,
  }));
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function update<K extends keyof WorkFormValues>(
    key: K,
    value: WorkFormValues[K]
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
      const result =
        mode === "create"
          ? await createWorkAction(values)
          : await updateWorkAction(workId as number, values);

      if (result.ok) {
        router.push("/admin/works");
        router.refresh();
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setTopError(result.error);
    } catch (err) {
      console.error("[WorkForm] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          value={
            values.seriesId === null ? NULL_SERIES_VALUE : String(values.seriesId)
          }
          onChange={(e) =>
            update(
              "seriesId",
              e.target.value === NULL_SERIES_VALUE
                ? null
                : Number(e.target.value)
            )
          }
          disabled={pending}
          className="flex h-9 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-1 text-sm outline-none transition-shadow shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value={NULL_SERIES_VALUE}>— 시리즈 없음 —</option>
          {series.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.nameKo} ({s.nameJp})
            </option>
          ))}
        </select>
      </Field>

      <Field id="work-nameKo" label="한국어 이름" error={fieldErrors.nameKo?.[0]}>
        <Input
          id="work-nameKo"
          name="nameKo"
          value={values.nameKo}
          onChange={(e) => update("nameKo", e.target.value)}
          disabled={pending}
          required
        />
      </Field>

      <Field id="work-nameJp" label="일본어 이름" error={fieldErrors.nameJp?.[0]}>
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

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[color:var(--color-foreground)]">
          섬네일
        </legend>
        <ThumbnailField
          id="work-logoUrl"
          name="logoUrl"
          label="로고 URL (선택)"
          value={values.logoUrl}
          onChange={(v) => update("logoUrl", v)}
          error={fieldErrors.logoUrl?.[0]}
          disabled={pending}
          aspect="16/9"
          hint="작품 로고/키비주얼."
        />
      </fieldset>

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

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/admin/works"
          aria-disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-transparent px-4 text-sm font-medium text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
        >
          취소
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
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
