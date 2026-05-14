"use server";

/**
 * `/admin/bands` Server Actions — Band 마스터 관리.
 *
 *  - 어드민 세션 강제.
 *  - mutation 성공 시 `/admin/bands` + `/admin/lives` 재검증
 *    (라이브 라인업이 밴드 검색에 의존).
 *  - P2003 (workId) → fieldErrors.workId.
 *  - P2003 (LiveBand 참조) → "출연 이력".
 *  - P2002 (slug) → fieldErrors.slug.
 *  - 빈 snsLinks 객체는 null 로 저장.
 *  - 모든 사용자향 메시지는 한국어.
 */

import { revalidatePath } from "next/cache";
import type { Band } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import { bandCreateSchema, bandUpdateSchema } from "@/lib/admin/schemas/band";
import {
  createBand as createBandRepo,
  deleteBand as deleteBandRepo,
  updateBand as updateBandRepo,
} from "@/lib/band/repo";

export type BandMutationResult =
  | { ok: true; band: Band }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type BandDeleteResult =
  | { ok: true }
  | { ok: false; error?: string };

const INVALID_ID_MESSAGE = "유효하지 않은 밴드 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 밴드입니다.";
const CREATE_FAILURE_MESSAGE = "밴드 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "밴드 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "밴드 삭제에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";
const INVALID_WORK_MESSAGE = "존재하지 않는 작품입니다.";
const BAND_IN_USE_MESSAGE = "출연 이력이 있는 밴드는 삭제할 수 없습니다.";

function isValidId(id: unknown): id is number {
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

function isInvalidWorkError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("존재하지 않는 작품");
}

function isBandInUseError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("출연 이력");
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("찾을 수 없");
}

function revalidateAffectedPaths(): void {
  revalidatePath("/admin/bands");
  revalidatePath("/admin/lives");
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  return value;
}

function snsLinksToStored(
  value: Record<string, string> | null | undefined
): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (Object.keys(value).length === 0) return null;
  return value;
}

// =====================================================================
// Server Actions
// =====================================================================

export type CreateBandInput = {
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string;
  officialUrl?: string;
  imageUrl?: string;
  description?: string;
  snsLinks?: Record<string, string> | null;
};

export async function createBandAction(
  input: CreateBandInput
): Promise<BandMutationResult> {
  await requireAdminSession();

  const parsed = bandCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const band = await createBandRepo({
      workId: data.workId,
      slug: data.slug,
      nameKo: data.nameKo,
      nameJp: data.nameJp,
      nameEn: emptyToNull(data.nameEn),
      officialUrl: emptyToNull(data.officialUrl),
      imageUrl: emptyToNull(data.imageUrl),
      description: emptyToNull(data.description),
      snsLinks: snsLinksToStored(data.snsLinks ?? null),
    });
    revalidateAffectedPaths();
    return { ok: true, band };
  } catch (err) {
    console.error("[createBandAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidWorkError(err)) {
      return {
        ok: false,
        fieldErrors: { workId: [INVALID_WORK_MESSAGE] },
      };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateBandPatch = Partial<{
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  officialUrl: string;
  imageUrl: string;
  description: string;
  snsLinks: Record<string, string> | null;
}>;

export async function updateBandAction(
  bandId: number,
  patch: UpdateBandPatch
): Promise<BandMutationResult> {
  await requireAdminSession();

  if (!isValidId(bandId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = bandUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const repoPatch: {
    workId?: number;
    slug?: string;
    nameKo?: string;
    nameJp?: string;
    nameEn?: string | null;
    officialUrl?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    snsLinks?: Record<string, string> | null;
  } = {};
  if (data.workId !== undefined) repoPatch.workId = data.workId;
  if (data.slug !== undefined) repoPatch.slug = data.slug;
  if (data.nameKo !== undefined) repoPatch.nameKo = data.nameKo;
  if (data.nameJp !== undefined) repoPatch.nameJp = data.nameJp;
  if (data.nameEn !== undefined) {
    repoPatch.nameEn = data.nameEn.length === 0 ? null : data.nameEn;
  }
  if (data.officialUrl !== undefined) {
    repoPatch.officialUrl =
      data.officialUrl.length === 0 ? null : data.officialUrl;
  }
  if (data.imageUrl !== undefined) {
    repoPatch.imageUrl = data.imageUrl.length === 0 ? null : data.imageUrl;
  }
  if (data.description !== undefined) {
    repoPatch.description =
      data.description.length === 0 ? null : data.description;
  }
  if (data.snsLinks !== undefined) {
    repoPatch.snsLinks = snsLinksToStored(data.snsLinks);
  }

  try {
    const band = await updateBandRepo(bandId, repoPatch);
    revalidateAffectedPaths();
    return { ok: true, band };
  } catch (err) {
    console.error("[updateBandAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidWorkError(err)) {
      return {
        ok: false,
        fieldErrors: { workId: [INVALID_WORK_MESSAGE] },
      };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }
}

export async function deleteBandAction(
  bandId: number
): Promise<BandDeleteResult> {
  await requireAdminSession();

  if (!isValidId(bandId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  try {
    await deleteBandRepo(bandId);
    revalidateAffectedPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteBandAction]", err);
    if (isBandInUseError(err)) {
      return { ok: false, error: BAND_IN_USE_MESSAGE };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}
