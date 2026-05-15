"use server";

/**
 * `/admin/tours` Server Actions — Tour 마스터 관리.
 *
 *  - 어드민 세션 강제.
 *  - mutation 성공 시 `/admin/tours` + `/admin/lives` 재검증 (Live 폼의 Tour 셀렉트).
 *  - P2002 (slug unique) → fieldErrors.slug.
 *  - P2003 (workId 미존재) → fieldErrors.workId.
 *  - 모든 사용자향 메시지는 한국어.
 */

import { revalidatePath } from "next/cache";
import type { Tour } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import { tourCreateSchema, tourUpdateSchema } from "@/lib/admin/schemas/tour";
import { jstLocalToUtc } from "@/lib/admin/jst-datetime";
import {
  createTour as createTourRepo,
  deleteTour as deleteTourRepo,
  updateTour as updateTourRepo,
} from "@/lib/tours/repo";

export type TourMutationResult =
  | { ok: true; tour: Tour }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type TourDeleteResult = { ok: true } | { ok: false; error?: string };

const INVALID_ID_MESSAGE = "유효하지 않은 투어 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 투어입니다.";
const CREATE_FAILURE_MESSAGE = "투어 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "투어 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "투어 삭제에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";
const INVALID_WORK_MESSAGE = "존재하지 않는 작품입니다.";

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

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("찾을 수 없");
}

function revalidateAffectedPaths(): void {
  revalidatePath("/admin/tours");
  revalidatePath("/admin/lives");
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  return value;
}

function jstOrNull(value: string | undefined): Date | null {
  if (value === undefined || value.length === 0) return null;
  return jstLocalToUtc(value);
}

// =====================================================================
// Server Actions
// =====================================================================

export type CreateTourInput = {
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string;
  description?: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  officialUrl?: string;
  startsAtJst?: string;
  endsAtJst?: string;
  status?: "DRAFT" | "PUBLISHED";
};

export async function createTourAction(
  input: CreateTourInput
): Promise<TourMutationResult> {
  await requireAdminSession();

  const parsed = tourCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const tour = await createTourRepo({
      workId: data.workId,
      slug: data.slug,
      nameKo: data.nameKo,
      nameJp: data.nameJp,
      nameEn: emptyToNull(data.nameEn),
      description: emptyToNull(data.description),
      posterUrl: emptyToNull(data.posterUrl),
      thumbnailUrl: emptyToNull(data.thumbnailUrl),
      officialUrl: emptyToNull(data.officialUrl),
      startsAt: jstOrNull(data.startsAtJst),
      endsAt: jstOrNull(data.endsAtJst),
      status: data.status ?? "DRAFT",
    });
    revalidateAffectedPaths();
    return { ok: true, tour };
  } catch (err) {
    console.error("[createTourAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidWorkError(err)) {
      return { ok: false, fieldErrors: { workId: [INVALID_WORK_MESSAGE] } };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateTourPatch = Partial<{
  workId: number;
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
}>;

export async function updateTourAction(
  tourId: number,
  patch: UpdateTourPatch
): Promise<TourMutationResult> {
  await requireAdminSession();

  if (!isValidId(tourId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = tourUpdateSchema.safeParse(patch);
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
    description?: string | null;
    posterUrl?: string | null;
    thumbnailUrl?: string | null;
    officialUrl?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    status?: "DRAFT" | "PUBLISHED";
  } = {};
  if (data.workId !== undefined) repoPatch.workId = data.workId;
  if (data.slug !== undefined) repoPatch.slug = data.slug;
  if (data.nameKo !== undefined) repoPatch.nameKo = data.nameKo;
  if (data.nameJp !== undefined) repoPatch.nameJp = data.nameJp;
  if (data.nameEn !== undefined) {
    repoPatch.nameEn = data.nameEn.length === 0 ? null : data.nameEn;
  }
  if (data.description !== undefined) {
    repoPatch.description = data.description.length === 0 ? null : data.description;
  }
  if (data.posterUrl !== undefined) {
    repoPatch.posterUrl = data.posterUrl.length === 0 ? null : data.posterUrl;
  }
  if (data.thumbnailUrl !== undefined) {
    repoPatch.thumbnailUrl =
      data.thumbnailUrl.length === 0 ? null : data.thumbnailUrl;
  }
  if (data.officialUrl !== undefined) {
    repoPatch.officialUrl =
      data.officialUrl.length === 0 ? null : data.officialUrl;
  }
  if (data.startsAtJst !== undefined) {
    repoPatch.startsAt = jstOrNull(data.startsAtJst);
  }
  if (data.endsAtJst !== undefined) {
    repoPatch.endsAt = jstOrNull(data.endsAtJst);
  }
  if (data.status !== undefined) repoPatch.status = data.status;

  try {
    const tour = await updateTourRepo(tourId, repoPatch);
    revalidateAffectedPaths();
    return { ok: true, tour };
  } catch (err) {
    console.error("[updateTourAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidWorkError(err)) {
      return { ok: false, fieldErrors: { workId: [INVALID_WORK_MESSAGE] } };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }
}

export async function deleteTourAction(
  tourId: number
): Promise<TourDeleteResult> {
  await requireAdminSession();

  if (!isValidId(tourId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  try {
    await deleteTourRepo(tourId);
    revalidateAffectedPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteTourAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}
