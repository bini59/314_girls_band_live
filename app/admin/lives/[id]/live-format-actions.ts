"use server";

/**
 * LiveFormat 섹션 Server Actions.
 *
 * - create / update / delete 세 가지 mutation 제공.
 * - 모든 호출은 requireAdminSession 으로 인증.
 * - update/delete 는 대상 LiveFormat 이 어느 Live 에 속하는지 확인하고,
 *   해당 Live 가 soft-delete 되지 않았는지 검증한다 (cross-live 공격 방지).
 * - 성공 시 `/admin/lives/{liveId}` revalidatePath.
 * - 빈 문자열 optional 필드("")는 null 로 정규화.
 */
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guard";
import {
  liveFormatCreateSchema,
  liveFormatUpdateSchema,
} from "@/lib/admin/schemas/live-format";
import {
  createLiveFormat,
  deleteLiveFormat,
  updateLiveFormat,
  type UpdateLiveFormatPatch,
} from "@/lib/live-format/repo";
import { prisma } from "@/lib/db";
import type { LiveFormat, LiveFormatType } from "@prisma/client";

/** 직렬화된 LiveFormat (Date 가 없으므로 그대로 사용 가능). */
export type SerializedLiveFormat = {
  id: number;
  liveId: number;
  type: LiveFormatType;
  label: string | null;
  venueName: string | null;
  url: string | null;
};

/** create/update/delete 공통 응답. create 는 format 동봉. */
export type LiveFormatActionResult =
  | { ok: true; format?: SerializedLiveFormat }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

const INVALID_LIVE_ID_MESSAGE = "유효하지 않은 라이브 ID 입니다.";
const INVALID_FORMAT_ID_MESSAGE = "유효하지 않은 포맷 ID 입니다.";
const LIVE_NOT_FOUND_MESSAGE = "이미 삭제된 라이브입니다.";
const FORMAT_NOT_FOUND_MESSAGE = "포맷을 찾을 수 없습니다.";
const CREATE_FAILURE_MESSAGE = "포맷 등록에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "포맷 수정에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "포맷 삭제에 실패했습니다.";

/** 양의 정수인지 검증. */
function isValidId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

/** 빈 문자열을 null 로 정규화. undefined 는 그대로. */
function normalizeOptional(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === "") return null;
  return v;
}

/** Live 가 존재하고 soft-deleted 아닌지 확인. */
async function getLiveIfActive(
  liveId: number
): Promise<{ id: number } | null> {
  const live = await prisma.live.findFirst({
    where: { id: liveId, deletedAt: null },
    select: { id: true },
  });
  return live;
}

/** LiveFormat 의 소유 liveId 조회 (live 가 soft-deleted 이면 null). */
async function getFormatOwnerLiveId(formatId: number): Promise<number | null> {
  const row = await prisma.liveFormat.findFirst({
    where: { id: formatId, live: { deletedAt: null } },
    select: { liveId: true },
  });
  return row?.liveId ?? null;
}

/** Prisma LiveFormat → SerializedLiveFormat. */
function serialize(format: LiveFormat): SerializedLiveFormat {
  return {
    id: format.id,
    liveId: format.liveId,
    type: format.type,
    label: format.label,
    venueName: format.venueName,
    url: format.url,
  };
}

export type CreateLiveFormatInput = {
  type: LiveFormatType;
  label?: string;
  venueName?: string;
  url?: string;
};

/**
 * Server Action: LiveFormat 생성.
 *
 * - liveId 검증 + Live 활성 여부 확인.
 * - Zod 검증 (type 필수, label/venueName/url optional).
 * - 빈 문자열 → null.
 * - revalidatePath('/admin/lives/{liveId}').
 */
export async function createLiveFormatAction(
  liveId: number,
  input: CreateLiveFormatInput
): Promise<LiveFormatActionResult> {
  await requireAdminSession();

  if (!isValidId(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }

  const live = await getLiveIfActive(liveId);
  if (!live) {
    return { ok: false, error: LIVE_NOT_FOUND_MESSAGE };
  }

  const parsed = liveFormatCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const created = await createLiveFormat({
      liveId,
      type: data.type,
      label: normalizeOptional(data.label),
      venueName: normalizeOptional(data.venueName),
      url: normalizeOptional(data.url),
    });
    revalidatePath(`/admin/lives/${liveId}`);
    return { ok: true, format: serialize(created) };
  } catch (err) {
    console.error("[createLiveFormatAction]", err);
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateLiveFormatActionPatch = Partial<{
  type: LiveFormatType;
  label: string;
  venueName: string;
  url: string;
}>;

/**
 * Server Action: LiveFormat 부분 업데이트.
 *
 * - formatId 검증.
 * - 소속 Live 확인 (soft-deleted 이면 거부).
 * - Zod partial 검증.
 * - 빈 문자열 → null.
 */
export async function updateLiveFormatAction(
  formatId: number,
  patch: UpdateLiveFormatActionPatch
): Promise<LiveFormatActionResult> {
  await requireAdminSession();

  if (!isValidId(formatId)) {
    return { ok: false, error: INVALID_FORMAT_ID_MESSAGE };
  }

  const ownerLiveId = await getFormatOwnerLiveId(formatId);
  if (ownerLiveId === null) {
    return { ok: false, error: FORMAT_NOT_FOUND_MESSAGE };
  }

  const parsed = liveFormatUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const repoPatch: UpdateLiveFormatPatch = {};
  if (data.type !== undefined) repoPatch.type = data.type;
  if (data.label !== undefined) {
    repoPatch.label = normalizeOptional(data.label) ?? null;
  }
  if (data.venueName !== undefined) {
    repoPatch.venueName = normalizeOptional(data.venueName) ?? null;
  }
  if (data.url !== undefined) {
    repoPatch.url = normalizeOptional(data.url) ?? null;
  }

  try {
    await updateLiveFormat(formatId, repoPatch);
  } catch (err) {
    console.error("[updateLiveFormatAction]", err);
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${ownerLiveId}`);
  return { ok: true };
}

/**
 * Server Action: LiveFormat 삭제.
 *
 * - formatId 검증.
 * - 소속 Live 확인 (soft-deleted 이면 거부).
 * - cascade 로 TicketTier / TicketSaleTier 도 삭제됨.
 */
export async function deleteLiveFormatAction(
  formatId: number
): Promise<LiveFormatActionResult> {
  await requireAdminSession();

  if (!isValidId(formatId)) {
    return { ok: false, error: INVALID_FORMAT_ID_MESSAGE };
  }

  const ownerLiveId = await getFormatOwnerLiveId(formatId);
  if (ownerLiveId === null) {
    return { ok: false, error: FORMAT_NOT_FOUND_MESSAGE };
  }

  try {
    await deleteLiveFormat(formatId);
  } catch (err) {
    console.error("[deleteLiveFormatAction]", err);
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${ownerLiveId}`);
  return { ok: true };
}
