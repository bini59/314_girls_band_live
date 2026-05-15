"use client";

/**
 * TourForm — 투어 생성/편집 페이지 폼.
 *
 *  - mode: "create" | "edit"
 *  - 필수: workId(작품 선택), slug, nameKo, nameJp.
 *  - 옵셔널: nameEn, description, posterUrl, thumbnailUrl, officialUrl,
 *           startsAtJst, endsAtJst (JST datetime-local), status.
 *  - 클라이언트 측 Zod 사전 검증 + 서버 측 fieldErrors 표시.
 *  - 저장 성공 시 /admin/tours 로 이동.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Work } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThumbnailField } from "@/components/admin/ThumbnailField";

import { tourCreateSchema, tourUpdateSchema } from "@/lib/admin/schemas/tour";

import { createTourAction, updateTourAction } from "../actions";

export type TourFormValues = {
  workId: number | null;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  description: string;
  posterUrl: string;
  thumbnailUrl: string;
  officialUrl: string;
  startsAtJst: string;
  endsAtJst: string;
  status: "DRAFT" | "PUBLISHED";
};

export type TourFormInitial = Partial<TourFormValues> & { id?: number };

export interface TourFormProps {
  mode: "create" | "edit";
  tourId?: number;
  initial?: TourFormInitial;
  works: Work[];
}

const EMPTY_VALUES: TourFormValues = {
  workId: null,
  slug: "",
  nameKo: "",
  nameJp: "",
  nameEn: "",
  description: "",
  posterUrl: "",
  thumbnailUrl: "",
  officialUrl: "",
  startsAtJst: "",
  endsAtJst: "",
  status: "DRAFT",
};

const NULL_WORK_VALUE = "__null__";

export function TourForm({ mode, tourId, initial, works }: TourFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<TourFormValues>(() => ({
    ...EMPTY_VALUES,
    ...initial,
    workId: initial?.workId ?? null,
  }));
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function update<K extends keyof TourFormValues>(
    key: K,
    value: TourFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    // workId null 가드 (create 모드에서 작품 필수).
    if (mode === "create" && values.workId === null) {
      setFieldErrors({ workId: ["작품을 선택해주세요."] });
      return;
    }

    const schema = mode === "create" ? tourCreateSchema : tourUpdateSchema;
    const parsed = schema.safeParse({
      ...values,
      workId: values.workId ?? undefined,
    });
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
      return;
    }

    setPending(true);
    try {
      const payload = {
        ...values,
        workId: values.workId as number,
      };
      const result =
        mode === "create"
          ? await createTourAction(payload)
          : await updateTourAction(tourId as number, payload);

      if (result.ok) {
        router.push("/admin/tours");
        router.refresh();
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setTopError(result.error);
    } catch (err) {
      console.error("[TourForm] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        id="tour-work"
        label="작품"
        error={fieldErrors.workId?.[0]}
        hint="이 투어가 속한 작품을 선택하세요."
      >
        <select
          id="tour-work"
          name="workId"
          value={values.workId === null ? NULL_WORK_VALUE : String(values.workId)}
          onChange={(e) =>
            update(
              "workId",
              e.target.value === NULL_WORK_VALUE
                ? null
                : Number(e.target.value)
            )
          }
          disabled={pending}
          className="flex h-9 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-1 text-sm outline-none transition-shadow shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60"
          required
        >
          <option value={NULL_WORK_VALUE}>— 작품 선택 —</option>
          {works.map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.nameKo} ({w.nameJp})
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="tour-slug"
        label="slug"
        error={fieldErrors.slug?.[0]}
        hint="소문자/숫자/하이픈만 (예: gakumas-tour-shirube)"
      >
        <Input
          id="tour-slug"
          name="slug"
          value={values.slug}
          onChange={(e) => update("slug", e.target.value)}
          disabled={pending}
          autoComplete="off"
          required
        />
      </Field>

      <Field id="tour-nameKo" label="한국어 이름" error={fieldErrors.nameKo?.[0]}>
        <Input
          id="tour-nameKo"
          name="nameKo"
          value={values.nameKo}
          onChange={(e) => update("nameKo", e.target.value)}
          disabled={pending}
          required
        />
      </Field>

      <Field id="tour-nameJp" label="일본어 이름" error={fieldErrors.nameJp?.[0]}>
        <Input
          id="tour-nameJp"
          name="nameJp"
          value={values.nameJp}
          onChange={(e) => update("nameJp", e.target.value)}
          disabled={pending}
          required
        />
      </Field>

      <Field
        id="tour-nameEn"
        label="영어 이름 (선택)"
        error={fieldErrors.nameEn?.[0]}
      >
        <Input
          id="tour-nameEn"
          name="nameEn"
          value={values.nameEn}
          onChange={(e) => update("nameEn", e.target.value)}
          disabled={pending}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="tour-startsAt"
          label="시작일 (JST, 선택)"
          error={fieldErrors.startsAtJst?.[0]}
          hint="첫 회차 일자/시각. 표시 정렬용."
        >
          <Input
            id="tour-startsAt"
            name="startsAtJst"
            type="datetime-local"
            value={values.startsAtJst}
            onChange={(e) => update("startsAtJst", e.target.value)}
            disabled={pending}
          />
        </Field>
        <Field
          id="tour-endsAt"
          label="종료일 (JST, 선택)"
          error={fieldErrors.endsAtJst?.[0]}
          hint="마지막 회차 일자/시각."
        >
          <Input
            id="tour-endsAt"
            name="endsAtJst"
            type="datetime-local"
            value={values.endsAtJst}
            onChange={(e) => update("endsAtJst", e.target.value)}
            disabled={pending}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[color:var(--color-foreground)]">
          섬네일/포스터
        </legend>
        <ThumbnailField
          id="tour-posterUrl"
          name="posterUrl"
          label="포스터 URL (선택)"
          value={values.posterUrl}
          onChange={(v) => update("posterUrl", v)}
          error={fieldErrors.posterUrl?.[0]}
          disabled={pending}
          aspect="3/4"
          hint="투어 키비주얼/포스터."
        />
        <ThumbnailField
          id="tour-thumbnailUrl"
          name="thumbnailUrl"
          label="섬네일 URL (선택)"
          value={values.thumbnailUrl}
          onChange={(v) => update("thumbnailUrl", v)}
          error={fieldErrors.thumbnailUrl?.[0]}
          disabled={pending}
          aspect="16/9"
          hint="목록/카드용."
        />
      </fieldset>

      <Field
        id="tour-officialUrl"
        label="공식 URL (선택)"
        error={fieldErrors.officialUrl?.[0]}
      >
        <Input
          id="tour-officialUrl"
          name="officialUrl"
          value={values.officialUrl}
          onChange={(e) => update("officialUrl", e.target.value)}
          disabled={pending}
          placeholder="https://..."
        />
      </Field>

      <Field
        id="tour-description"
        label="설명 (선택)"
        error={fieldErrors.description?.[0]}
      >
        <Textarea
          id="tour-description"
          name="description"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          disabled={pending}
          rows={3}
        />
      </Field>

      <Field id="tour-status" label="상태">
        <select
          id="tour-status"
          name="status"
          value={values.status}
          onChange={(e) =>
            update("status", e.target.value as "DRAFT" | "PUBLISHED")
          }
          disabled={pending}
          className="flex h-9 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-1 text-sm outline-none transition-shadow shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="DRAFT">초안</option>
          <option value="PUBLISHED">공개</option>
        </select>
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
          href="/admin/tours"
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
