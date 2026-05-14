"use server";

/**
 * `/admin/works` Server Actions — Work 마스터 관리.
 *
 *  - 어드민 세션 강제.
 *  - mutation 성공 시 `/admin/works` + `/admin/bands` 재검증 (Band 페이지의 Work 셀렉트).
 *  - P2003 (존재하지 않는 seriesId) → fieldErrors.seriesId.
 *  - P2003 (Band 참조 시 삭제) → "사용 중인 작품".
 *  - P2002 (slug unique) → fieldErrors.slug.
 *  - 모든 사용자향 메시지는 한국어.
 */

import { revalidatePath } from "next/cache";
import type { Work } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import { workCreateSchema, workUpdateSchema } from "@/lib/admin/schemas/work";
import {
  createWork as createWorkRepo,
  deleteWork as deleteWorkRepo,
  updateWork as updateWorkRepo,
} from "@/lib/works/repo";

export type WorkMutationResult =
  | { ok: true; work: Work }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type WorkDeleteResult =
  | { ok: true }
  | { ok: false; error?: string };

const INVALID_ID_MESSAGE = "유효하지 않은 작품 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 작품입니다.";
const CREATE_FAILURE_MESSAGE = "작품 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "작품 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "작품 삭제에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";
const INVALID_SERIES_MESSAGE = "존재하지 않는 시리즈입니다.";
const WORK_IN_USE_MESSAGE = "사용 중인 작품은 삭제할 수 없습니다.";

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

function isInvalidSeriesError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("존재하지 않는 시리즈");
}

function isWorkInUseError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("사용 중인 작품");
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("찾을 수 없");
}

function revalidateAffectedPaths(): void {
  revalidatePath("/admin/works");
  revalidatePath("/admin/bands");
}

// =====================================================================
// Server Actions
// =====================================================================

export type CreateWorkInput = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string;
  kind?: string;
  logoUrl?: string;
  description?: string;
  seriesId?: number | null;
};

export async function createWorkAction(
  input: CreateWorkInput
): Promise<WorkMutationResult> {
  await requireAdminSession();

  const parsed = workCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const work = await createWorkRepo({
      slug: data.slug,
      nameKo: data.nameKo,
      nameJp: data.nameJp,
      nameEn: emptyToNull(data.nameEn),
      kind: emptyToNull(data.kind),
      logoUrl: emptyToNull(data.logoUrl),
      description: emptyToNull(data.description),
      seriesId: data.seriesId ?? null,
    });
    revalidateAffectedPaths();
    return { ok: true, work };
  } catch (err) {
    console.error("[createWorkAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidSeriesError(err)) {
      return {
        ok: false,
        fieldErrors: { seriesId: [INVALID_SERIES_MESSAGE] },
      };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateWorkPatch = Partial<{
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  kind: string;
  logoUrl: string;
  description: string;
  seriesId: number | null;
}>;

export async function updateWorkAction(
  workId: number,
  patch: UpdateWorkPatch
): Promise<WorkMutationResult> {
  await requireAdminSession();

  if (!isValidId(workId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = workUpdateSchema.safeParse(patch);
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
    kind?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    seriesId?: number | null;
  } = {};
  if (data.slug !== undefined) repoPatch.slug = data.slug;
  if (data.nameKo !== undefined) repoPatch.nameKo = data.nameKo;
  if (data.nameJp !== undefined) repoPatch.nameJp = data.nameJp;
  if (data.nameEn !== undefined) {
    repoPatch.nameEn = data.nameEn.length === 0 ? null : data.nameEn;
  }
  if (data.kind !== undefined) {
    repoPatch.kind = data.kind.length === 0 ? null : data.kind;
  }
  if (data.logoUrl !== undefined) {
    repoPatch.logoUrl = data.logoUrl.length === 0 ? null : data.logoUrl;
  }
  if (data.description !== undefined) {
    repoPatch.description =
      data.description.length === 0 ? null : data.description;
  }
  if (data.seriesId !== undefined) repoPatch.seriesId = data.seriesId;

  try {
    const work = await updateWorkRepo(workId, repoPatch);
    revalidateAffectedPaths();
    return { ok: true, work };
  } catch (err) {
    console.error("[updateWorkAction]", err);
    if (isSlugTakenError(err)) {
      return { ok: false, fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] } };
    }
    if (isInvalidSeriesError(err)) {
      return {
        ok: false,
        fieldErrors: { seriesId: [INVALID_SERIES_MESSAGE] },
      };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }
}

export async function deleteWorkAction(
  workId: number
): Promise<WorkDeleteResult> {
  await requireAdminSession();

  if (!isValidId(workId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  try {
    await deleteWorkRepo(workId);
    revalidateAffectedPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteWorkAction]", err);
    if (isWorkInUseError(err)) {
      return { ok: false, error: WORK_IN_USE_MESSAGE };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  return value;
}
