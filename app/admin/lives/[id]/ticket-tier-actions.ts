"use server";

/**
 * TicketTier Server Actions — LiveFormat 산하 좌석/등급 mutation.
 *
 * - 모든 액션: 인증 → 입력검증 → cross-live/soft-delete 가드 → repo 호출 → revalidatePath.
 * - 응답은 자동저장(updateTicketTierAction) 또는 단일 mutation 결과로 사용된다.
 *   - 성공: `{ ok: true, tier?, savedAt? }`
 *   - 실패: `{ ok: false, error?, fieldErrors? }`
 *
 * 보안:
 *  - `getTierLiveId(tierId)` 로 tier 가 어느 live 에 속하는지 확인 후
 *    `getLiveById` 로 soft-deleted 여부를 검사.
 *  - reorder 는 repo 의 cross-format 가드(`reorderTicketTiers`) 결과를 그대로 surface.
 */

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guard";
import { getLiveById } from "@/lib/live/repo";
import { prisma } from "@/lib/db";
import {
  createTicketTier,
  deleteTicketTier,
  getTierLiveId,
  reorderTicketTiers,
  updateTicketTier,
  type UpdateTicketTierPatch,
} from "@/lib/ticket-tier/repo";
import {
  ticketTierCreateSchema,
  ticketTierReorderSchema,
  ticketTierUpdateSchema,
} from "@/lib/admin/schemas/ticket-tier";

/** 액션 응답 DTO. */
export type TicketTierDto = {
  id: number;
  name: string;
  priceJpy: number;
  order: number;
  notes: string | null;
};

export type TicketTierActionResult =
  | { ok: true; tier?: TicketTierDto; savedAt?: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

const INVALID_ID_MESSAGE = "유효하지 않은 ID 입니다.";
const NOT_FOUND_LIVE_MESSAGE = "이미 삭제된 라이브입니다.";
const NOT_FOUND_FORMAT_MESSAGE = "포맷을 찾을 수 없습니다.";
const NOT_FOUND_TIER_MESSAGE = "티어를 찾을 수 없습니다.";
const CREATE_FAILURE_MESSAGE = "티어 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "티어 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "티어 삭제에 실패했습니다.";
const REORDER_FAILURE_MESSAGE = "티어 순서 변경에 실패했습니다.";
const REORDER_CROSS_FORMAT_MESSAGE =
  "다른 포맷의 티어가 포함되어 있습니다.";
const REORDER_EMPTY_MESSAGE = "정렬 대상이 1개 이상 필요합니다.";

/** 양의 정수 ID 검증. */
function isValidId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

/** TicketTier DB row → DTO 변환. */
function toDto(tier: {
  id: number;
  name: string;
  priceJpy: number;
  order: number;
  notes: string | null;
}): TicketTierDto {
  return {
    id: tier.id,
    name: tier.name,
    priceJpy: tier.priceJpy,
    order: tier.order,
    notes: tier.notes,
  };
}

type FormatGuardResult =
  | { found: true; liveId: number }
  | { found: false; failure: TicketTierActionResult };

/**
 * format 에 연결된 라이브가 살아있는지 확인.
 *  - format 미존재 → `NOT_FOUND_FORMAT_MESSAGE`
 *  - soft-deleted live → `NOT_FOUND_LIVE_MESSAGE`
 */
async function assertFormatAccessible(
  formatId: number
): Promise<FormatGuardResult> {
  const format = await prisma.liveFormat.findUnique({
    where: { id: formatId },
    select: { liveId: true },
  });
  if (!format) {
    return {
      found: false,
      failure: { ok: false, error: NOT_FOUND_FORMAT_MESSAGE },
    };
  }
  const live = await getLiveById(format.liveId);
  if (!live) {
    return {
      found: false,
      failure: { ok: false, error: NOT_FOUND_LIVE_MESSAGE },
    };
  }
  return { found: true, liveId: format.liveId };
}

type TierGuardResult =
  | { found: true; liveId: number }
  | { found: false; failure: TicketTierActionResult };

/**
 * tier 에 연결된 라이브가 살아있는지 확인.
 *  - tier 미존재 → `NOT_FOUND_TIER_MESSAGE`
 *  - soft-deleted live → `NOT_FOUND_LIVE_MESSAGE`
 */
async function assertTierAccessible(tierId: number): Promise<TierGuardResult> {
  const liveId = await getTierLiveId(tierId);
  if (liveId === null) {
    return {
      found: false,
      failure: { ok: false, error: NOT_FOUND_TIER_MESSAGE },
    };
  }
  const live = await getLiveById(liveId);
  if (!live) {
    return {
      found: false,
      failure: { ok: false, error: NOT_FOUND_LIVE_MESSAGE },
    };
  }
  return { found: true, liveId };
}

/**
 * Server Action: TicketTier 생성.
 */
export async function createTicketTierAction(
  formatId: number,
  input: {
    name: string;
    priceJpy: number;
    order?: number;
    notes?: string;
  }
): Promise<TicketTierActionResult> {
  await requireAdminSession();

  if (!isValidId(formatId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = ticketTierCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const guard = await assertFormatAccessible(formatId);
  if (!guard.found) return guard.failure;

  const data = parsed.data;
  try {
    const created = await createTicketTier({
      formatId,
      name: data.name,
      priceJpy: data.priceJpy,
      order: data.order,
      // 빈 문자열 notes → null.
      notes:
        data.notes === undefined || data.notes.length === 0 ? null : data.notes,
    });
    revalidatePath(`/admin/lives/${guard.liveId}`);
    return { ok: true, tier: toDto(created), savedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[createTicketTierAction]", err);
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

/**
 * Server Action: TicketTier 부분 업데이트 (자동저장).
 */
export async function updateTicketTierAction(
  tierId: number,
  patch: Partial<{
    name: string;
    priceJpy: number;
    order: number;
    notes: string;
  }>
): Promise<TicketTierActionResult> {
  await requireAdminSession();

  if (!isValidId(tierId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = ticketTierUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const guard = await assertTierAccessible(tierId);
  if (!guard.found) {
    return guard.failure;
  }
  const liveId = guard.liveId;

  // patch 구성.
  const data = parsed.data;
  const update: UpdateTicketTierPatch = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.priceJpy !== undefined) update.priceJpy = data.priceJpy;
  if (data.order !== undefined) update.order = data.order;
  if (data.notes !== undefined) {
    // 빈 문자열 notes → null.
    update.notes = data.notes.length === 0 ? null : data.notes;
  }

  try {
    const updated = await updateTicketTier(tierId, update);
    revalidatePath(`/admin/lives/${liveId}`);
    return {
      ok: true,
      tier: toDto(updated),
      savedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[updateTicketTierAction]", err);
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }
}

/**
 * Server Action: TicketTier 삭제.
 *  - TicketSaleTier 까지 cascade.
 */
export async function deleteTicketTierAction(
  tierId: number
): Promise<TicketTierActionResult> {
  await requireAdminSession();

  if (!isValidId(tierId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const guard = await assertTierAccessible(tierId);
  if (!guard.found) {
    return guard.failure;
  }
  const liveId = guard.liveId;

  try {
    await deleteTicketTier(tierId);
    revalidatePath(`/admin/lives/${liveId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteTicketTierAction]", err);
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}

/**
 * Server Action: 한 LiveFormat 의 TicketTier 순서를 일괄 재할당.
 */
export async function reorderTicketTiersAction(
  formatId: number,
  orderedTierIds: number[]
): Promise<TicketTierActionResult> {
  await requireAdminSession();

  if (!isValidId(formatId)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  const parsed = ticketTierReorderSchema.safeParse(orderedTierIds);
  if (!parsed.success) {
    return {
      ok: false,
      error: REORDER_EMPTY_MESSAGE,
      fieldErrors: { orderedTierIds: parsed.error.flatten().formErrors },
    };
  }

  const guard = await assertFormatAccessible(formatId);
  if (!guard.found) return guard.failure;

  try {
    await reorderTicketTiers(formatId, parsed.data);
  } catch (err) {
    console.error("[reorderTicketTiersAction]", err);
    // repo 가 던지는 cross-format 메시지는 사용자에게는 일반화된 메시지로 변환.
    if (
      err instanceof Error &&
      err.message.includes("속하지 않습니다")
    ) {
      return { ok: false, error: REORDER_CROSS_FORMAT_MESSAGE };
    }
    return { ok: false, error: REORDER_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${guard.liveId}`);
  return { ok: true, savedAt: new Date().toISOString() };
}
