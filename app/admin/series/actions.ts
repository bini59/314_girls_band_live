"use server";

/**
 * `/admin/series` Server Actions — Series 마스터 관리.
 *
 *  - 어드민 세션 강제 (`requireAdminSession`).
 *  - 입력 검증 (Zod: seriesCreateSchema / seriesUpdateSchema).
 *  - 도메인 repo (`lib/series/repo`) 호출.
 *  - mutation 성공 시 `/admin/series` 및 `/admin/works` 재검증
 *    (Work 페이지의 Series 셀렉트 옵션이 변할 수 있으므로).
 *
 * 응답 형식 (discriminated union):
 *  - 성공: `{ ok: true, series }` 또는 `{ ok: true }`
 *  - 실패: `{ ok: false, error?, fieldErrors? }`
 *
 * 에러 매핑:
 *  - P2002 (slug unique) → fieldErrors.slug.
 *  - P2025 → "이미 삭제된 시리즈입니다.".
 *
 * 모든 사용자향 메시지는 한국어.
 */

import { revalidatePath } from "next/cache";
import type { Series } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import {
  seriesCreateSchema,
  seriesUpdateSchema,
} from "@/lib/admin/schemas/series";
import {
  createSeries as createSeriesRepo,
  deleteSeries as deleteSeriesRepo,
  updateSeries as updateSeriesRepo,
} from "@/lib/series/repo";

export type SeriesMutationResult =
  | { ok: true; series: Series }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type SeriesDeleteResult =
  | { ok: true }
  | { ok: false; error?: string };

const INVALID_SERIES_ID_MESSAGE = "유효하지 않은 시리즈 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 시리즈입니다.";
const CREATE_FAILURE_MESSAGE = "시리즈 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "시리즈 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "시리즈 삭제에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";

function isValidSeriesId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

function isSlugTakenError(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return true;
  }
  return err instanceof Error && err.message.includes("이미 사용 중인 slug");
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("찾을 수 없");
}

function revalidateAffectedPaths(): void {
  revalidatePath("/admin/series");
  revalidatePath("/admin/works");
}

function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.length === 0 ? null : value;
}

// =====================================================================
// Server Actions
// =====================================================================

export type CreateSeriesInput = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string;
  logoUrl?: string;
  description?: string;
};

export async function createSeriesAction(
  input: CreateSeriesInput
): Promise<SeriesMutationResult> {
  await requireAdminSession();

  const parsed = seriesCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const series = await createSeriesRepo({
      slug: data.slug,
      nameKo: data.nameKo,
      nameJp: data.nameJp,
      nameEn: emptyToNull(data.nameEn) ?? null,
      logoUrl: emptyToNull(data.logoUrl) ?? null,
      description: emptyToNull(data.description) ?? null,
    });
    revalidateAffectedPaths();
    return { ok: true, series };
  } catch (err) {
    console.error("[createSeriesAction]", err);
    if (isSlugTakenError(err)) {
      return {
        ok: false,
        fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] },
      };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateSeriesPatch = Partial<{
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  logoUrl: string;
  description: string;
}>;

export async function updateSeriesAction(
  seriesId: number,
  patch: UpdateSeriesPatch
): Promise<SeriesMutationResult> {
  await requireAdminSession();

  if (!isValidSeriesId(seriesId)) {
    return { ok: false, error: INVALID_SERIES_ID_MESSAGE };
  }

  const parsed = seriesUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const repoPatch: {
    slug?: string;
    nameKo?: string;
    nameJp?: string;
    nameEn?: string | null;
    logoUrl?: string | null;
    description?: string | null;
  } = {};
  if (data.slug !== undefined) repoPatch.slug = data.slug;
  if (data.nameKo !== undefined) repoPatch.nameKo = data.nameKo;
  if (data.nameJp !== undefined) repoPatch.nameJp = data.nameJp;
  if (data.nameEn !== undefined) {
    repoPatch.nameEn = data.nameEn.length === 0 ? null : data.nameEn;
  }
  if (data.logoUrl !== undefined) {
    repoPatch.logoUrl = data.logoUrl.length === 0 ? null : data.logoUrl;
  }
  if (data.description !== undefined) {
    repoPatch.description =
      data.description.length === 0 ? null : data.description;
  }

  try {
    const series = await updateSeriesRepo(seriesId, repoPatch);
    revalidateAffectedPaths();
    return { ok: true, series };
  } catch (err) {
    console.error("[updateSeriesAction]", err);
    if (isSlugTakenError(err)) {
      return {
        ok: false,
        fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] },
      };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }
}

export async function deleteSeriesAction(
  seriesId: number
): Promise<SeriesDeleteResult> {
  await requireAdminSession();

  if (!isValidSeriesId(seriesId)) {
    return { ok: false, error: INVALID_SERIES_ID_MESSAGE };
  }

  try {
    await deleteSeriesRepo(seriesId);
    revalidateAffectedPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteSeriesAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}
