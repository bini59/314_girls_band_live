"use client";

/**
 * BandDialog — 밴드 생성/편집 모달.
 *
 *  - mode: "create" | "edit"
 *  - 필수: workId, slug, nameKo, nameJp.
 *  - 옵셔널: nameEn, officialUrl, imageUrl, description, snsLinks.
 *  - workId 셀렉트는 props `works` 로 전달. create 모드 기본값은 첫 번째 work.
 *  - snsLinks 는 key/value 동적 입력 (추천 키: twitter, youtube, instagram, tiktok).
 */

import * as React from "react";
import type { Work } from "@prisma/client";

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

import { bandCreateSchema, bandUpdateSchema } from "@/lib/admin/schemas/band";

type SnsRow = { key: string; value: string };

export type BandDialogValues = {
  workId: number | null;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  officialUrl: string;
  imageUrl: string;
  description: string;
  snsRows: SnsRow[];
};

export type BandDialogInitial = Partial<
  Omit<BandDialogValues, "snsRows">
> & {
  id?: number;
  snsLinks?: Record<string, string> | null;
};

export interface BandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: BandDialogInitial;
  works: Work[];
  onSubmit: (payload: {
    workId: number | null;
    slug: string;
    nameKo: string;
    nameJp: string;
    nameEn: string;
    officialUrl: string;
    imageUrl: string;
    description: string;
    snsLinks: Record<string, string>;
  }) => Promise<
    | { ok: true }
    | { ok: false; error?: string; fieldErrors?: Record<string, string[]> }
  >;
}

const SUGGESTED_KEYS = ["twitter", "youtube", "instagram", "tiktok"] as const;

function buildEmptyValues(works: Work[]): BandDialogValues {
  return {
    workId: works[0]?.id ?? null,
    slug: "",
    nameKo: "",
    nameJp: "",
    nameEn: "",
    officialUrl: "",
    imageUrl: "",
    description: "",
    snsRows: [],
  };
}

function snsLinksToRows(
  snsLinks: Record<string, string> | null | undefined
): SnsRow[] {
  if (!snsLinks) return [];
  return Object.entries(snsLinks).map(([key, value]) => ({ key, value }));
}

function rowsToSnsLinks(rows: SnsRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    const v = r.value.trim();
    // 키가 비어있으면 (값 유무와 무관하게) 무시 — 명시적 등록만 인정.
    if (k.length === 0) continue;
    result[k] = v;
  }
  return result;
}

export function BandDialog({
  open,
  onOpenChange,
  mode,
  initial,
  works,
  onSubmit,
}: BandDialogProps) {
  const [values, setValues] = React.useState<BandDialogValues>(() =>
    buildEmptyValues(works)
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [topError, setTopError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      workId: initial?.workId ?? works[0]?.id ?? null,
      slug: initial?.slug ?? "",
      nameKo: initial?.nameKo ?? "",
      nameJp: initial?.nameJp ?? "",
      nameEn: initial?.nameEn ?? "",
      officialUrl: initial?.officialUrl ?? "",
      imageUrl: initial?.imageUrl ?? "",
      description: initial?.description ?? "",
      snsRows: snsLinksToRows(initial?.snsLinks),
    });
    setFieldErrors({});
    setTopError(null);
    setPending(false);
  }, [open, initial, works]);

  function update<K extends keyof BandDialogValues>(
    key: K,
    value: BandDialogValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSnsRow(index: number, patch: Partial<SnsRow>) {
    setValues((prev) => ({
      ...prev,
      snsRows: prev.snsRows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  function addSnsRow(suggestedKey?: string) {
    setValues((prev) => ({
      ...prev,
      snsRows: [...prev.snsRows, { key: suggestedKey ?? "", value: "" }],
    }));
  }

  function removeSnsRow(index: number) {
    setValues((prev) => ({
      ...prev,
      snsRows: prev.snsRows.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const snsLinks = rowsToSnsLinks(values.snsRows);

    const candidate = {
      workId: values.workId,
      slug: values.slug,
      nameKo: values.nameKo,
      nameJp: values.nameJp,
      nameEn: values.nameEn,
      officialUrl: values.officialUrl,
      imageUrl: values.imageUrl,
      description: values.description,
      snsLinks,
    };

    const schema = mode === "create" ? bandCreateSchema : bandUpdateSchema;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
      return;
    }

    setPending(true);
    try {
      const result = await onSubmit({
        workId: values.workId,
        slug: values.slug,
        nameKo: values.nameKo,
        nameJp: values.nameJp,
        nameEn: values.nameEn,
        officialUrl: values.officialUrl,
        imageUrl: values.imageUrl,
        description: values.description,
        snsLinks,
      });
      if (result.ok) {
        onOpenChange(false);
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setTopError(result.error);
    } catch (err) {
      console.error("[BandDialog] submit", err);
      setTopError("저장 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "create" ? "밴드 추가" : "밴드 편집";
  const unusedSuggested = SUGGESTED_KEYS.filter(
    (k) => !values.snsRows.some((r) => r.key === k)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              밴드(MyGO!!!!!, 토게토게, μ&apos;s 등) 마스터 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <Field
            id="band-work"
            label="작품"
            error={fieldErrors.workId?.[0]}
            hint="밴드가 속한 작품을 선택합니다."
          >
            <select
              id="band-work"
              name="workId"
              value={values.workId === null ? "" : String(values.workId)}
              onChange={(e) =>
                update(
                  "workId",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              disabled={pending || works.length === 0}
              className="flex h-9 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]"
              required
            >
              {works.length === 0 ? (
                <option value="">먼저 작품을 등록해주세요</option>
              ) : null}
              {works.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.nameKo} ({w.nameJp})
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="band-slug"
            label="slug"
            error={fieldErrors.slug?.[0]}
            hint="소문자/숫자/하이픈만 (예: mygo)"
          >
            <Input
              id="band-slug"
              name="slug"
              value={values.slug}
              onChange={(e) => update("slug", e.target.value)}
              disabled={pending}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="band-nameKo"
            label="한국어 이름"
            error={fieldErrors.nameKo?.[0]}
          >
            <Input
              id="band-nameKo"
              name="nameKo"
              value={values.nameKo}
              onChange={(e) => update("nameKo", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="band-nameJp"
            label="일본어 이름"
            error={fieldErrors.nameJp?.[0]}
          >
            <Input
              id="band-nameJp"
              name="nameJp"
              value={values.nameJp}
              onChange={(e) => update("nameJp", e.target.value)}
              disabled={pending}
              required
            />
          </Field>

          <Field
            id="band-nameEn"
            label="영어 이름 (선택)"
            error={fieldErrors.nameEn?.[0]}
          >
            <Input
              id="band-nameEn"
              name="nameEn"
              value={values.nameEn}
              onChange={(e) => update("nameEn", e.target.value)}
              disabled={pending}
            />
          </Field>

          <Field
            id="band-officialUrl"
            label="공식 사이트 URL (선택)"
            error={fieldErrors.officialUrl?.[0]}
          >
            <Input
              id="band-officialUrl"
              name="officialUrl"
              type="url"
              value={values.officialUrl}
              onChange={(e) => update("officialUrl", e.target.value)}
              disabled={pending}
              placeholder="https://..."
            />
          </Field>

          <Field
            id="band-imageUrl"
            label="이미지 URL (선택)"
            error={fieldErrors.imageUrl?.[0]}
          >
            <Input
              id="band-imageUrl"
              name="imageUrl"
              type="url"
              value={values.imageUrl}
              onChange={(e) => update("imageUrl", e.target.value)}
              disabled={pending}
            />
          </Field>

          <SnsLinksField
            rows={values.snsRows}
            disabled={pending}
            error={fieldErrors.snsLinks?.[0]}
            onAdd={addSnsRow}
            onRemove={removeSnsRow}
            onChange={updateSnsRow}
            unusedSuggested={unusedSuggested}
          />

          <Field
            id="band-description"
            label="설명 (선택)"
            error={fieldErrors.description?.[0]}
          >
            <Textarea
              id="band-description"
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

function SnsLinksField({
  rows,
  disabled,
  error,
  onAdd,
  onRemove,
  onChange,
  unusedSuggested,
}: {
  rows: SnsRow[];
  disabled: boolean;
  error?: string;
  onAdd: (suggestedKey?: string) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<SnsRow>) => void;
  unusedSuggested: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>SNS 링크 (선택)</Label>
      {rows.length === 0 ? (
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          아직 등록된 SNS 링크가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
              data-testid={`sns-row-${index}`}
            >
              <Input
                placeholder="key (예: twitter)"
                value={row.key}
                onChange={(e) => onChange(index, { key: e.target.value })}
                disabled={disabled}
                className="w-40"
                aria-label={`SNS 키 ${index + 1}`}
              />
              <Input
                type="url"
                placeholder="https://..."
                value={row.value}
                onChange={(e) => onChange(index, { value: e.target.value })}
                disabled={disabled}
                aria-label={`SNS URL ${index + 1}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`SNS 링크 ${index + 1} 제거`}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd()}
          disabled={disabled}
        >
          + SNS 링크 추가
        </Button>
        {unusedSuggested.map((k) => (
          <Button
            key={k}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAdd(k)}
            disabled={disabled}
          >
            + {k}
          </Button>
        ))}
      </div>

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
