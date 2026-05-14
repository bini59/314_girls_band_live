"use server";

/**
 * `/admin/lives/[id]` 의 LiveBand (출연 밴드) Server Actions.
 *
 * 책임:
 *  - 어드민 세션 강제 (`requireAdminSession`)
 *  - 입력 검증 (liveId/bandId 양의 정수, Zod 스키마)
 *  - 도메인 repo (`lib/live-band/repo`, `lib/band/repo`) 호출
 *  - mutation 성공 시 `revalidatePath("/admin/lives/{liveId}")`
 *
 * 응답 형식 (discriminated union):
 *  - 성공: `{ ok: true, ... }`
 *  - 실패: `{ ok: false, error?, fieldErrors? }`
 *
 * 에러 메시지는 한국어. 원본 예외는 서버 로그에만, 사용자에게는 일반화된 메시지.
 */

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guard";
import { getLiveById } from "@/lib/live/repo";
import {
  addLiveBand,
  listLiveBands,
  removeLiveBand,
  reorderLiveBands,
  updateLiveBand,
} from "@/lib/live-band/repo";
import { getBandById, searchBands } from "@/lib/band/repo";
import {
  liveBandReorderSchema,
  liveBandUpsertSchema,
} from "@/lib/admin/schemas/live-band";

// =====================================================================
// 응답 타입
// =====================================================================

export type BandSearchResult = {
  id: number;
  nameKo: string;
  nameJp: string;
  nameEn: string | null;
  slug: string;
};

export type SearchBandsResult =
  | { ok: true; bands: BandSearchResult[] }
  | { ok: false; error: string };

export type LiveBandMutationResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

// =====================================================================
// 메시지 상수 (한국어)
// =====================================================================

const INVALID_LIVE_ID_MESSAGE = "유효하지 않은 라이브 ID 입니다.";
const INVALID_BAND_ID_MESSAGE = "유효하지 않은 밴드 ID 입니다.";
const LIVE_NOT_FOUND_MESSAGE = "이미 삭제된 라이브이거나 존재하지 않습니다.";
const BAND_NOT_FOUND_MESSAGE = "선택한 밴드를 찾을 수 없습니다.";
const ADD_FAILURE_MESSAGE = "출연 밴드 추가에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "출연 밴드 업데이트에 실패했습니다.";
const REMOVE_FAILURE_MESSAGE = "출연 밴드 제거에 실패했습니다.";
const REORDER_FAILURE_MESSAGE = "출연 밴드 순서 변경에 실패했습니다.";
const REORDER_EMPTY_MESSAGE = "정렬 대상이 1개 이상 필요합니다.";
const REORDER_MISMATCH_MESSAGE =
  "다른 라이브의 밴드는 정렬할 수 없습니다.";
const DUPLICATE_BAND_MESSAGE = "이미 추가된 밴드입니다.";
const SEARCH_FAILURE_MESSAGE = "밴드 검색에 실패했습니다.";

// 검색 쿼리 길이 상한 — 비정상적으로 긴 입력으로부터 보호.
const MAX_SEARCH_QUERY_LENGTH = 100;

// =====================================================================
// 헬퍼
// =====================================================================

/** 양의 정수 검증. */
function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Prisma P2002 (composite PK 중복) 또는 repo 가 던진 "이미 추가된 밴드" 메시지 판별. */
function isDuplicateLiveBandError(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return true;
  }
  return (
    err instanceof Error && err.message.includes("이미 추가된 밴드")
  );
}

/** repo 의 "찾을 수 없습니다" 패턴 매칭. */
function isNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("찾을 수 없") || err.message.includes("삭제됨"))
  );
}

/** repo.reorderLiveBands 가 던진 "다른 라이브 소속" 에러 판별. */
function isReorderMismatchError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("속하지 않습니다")
  );
}

/**
 * 공통 가드: 어드민 세션 + liveId 검증 + Live 존재 확인.
 *
 * 성공 시 `{ ok: true }`, 실패 시 `{ ok: false, error }` 반환.
 * 호출자는 결과 객체를 그대로 클라이언트에 반환하면 된다.
 */
async function guardLive(
  liveId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPositiveInt(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }
  const live = await getLiveById(liveId);
  if (!live) {
    return { ok: false, error: LIVE_NOT_FOUND_MESSAGE };
  }
  return { ok: true };
}

// =====================================================================
// Server Actions
// =====================================================================

/**
 * 밴드 검색. 콤보박스의 비동기 datasource.
 *
 * - 빈/공백 query 또는 길이 초과 → 빈 배열.
 * - 100자 초과 query 는 잘라서 검색.
 * - 원본 에러는 로그, 사용자에게는 일반화 메시지.
 */
export async function searchBandsAction(query: string): Promise<SearchBandsResult> {
  await requireAdminSession();

  if (typeof query !== "string") {
    return { ok: true, bands: [] };
  }
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { ok: true, bands: [] };
  }
  const safeQuery = trimmed.slice(0, MAX_SEARCH_QUERY_LENGTH);

  try {
    const bands = await searchBands(safeQuery);
    return {
      ok: true,
      bands: bands.map((b) => ({
        id: b.id,
        nameKo: b.nameKo,
        nameJp: b.nameJp,
        nameEn: b.nameEn,
        slug: b.slug,
      })),
    };
  } catch (err) {
    console.error("[searchBandsAction]", err);
    return { ok: false, error: SEARCH_FAILURE_MESSAGE };
  }
}

/**
 * Live 에 Band 1건 추가.
 *
 * - opts.isHeadliner 기본 false.
 * - order 기본값: 현재 라인업 길이 (말단에 append).
 * - 중복 (composite PK 충돌) → 한국어 메시지로 변환.
 */
export async function addLiveBandAction(
  liveId: number,
  bandId: number,
  opts: { isHeadliner?: boolean } = {}
): Promise<LiveBandMutationResult> {
  await requireAdminSession();

  const liveGuard = await guardLive(liveId);
  if (!liveGuard.ok) {
    return liveGuard;
  }
  if (!isPositiveInt(bandId)) {
    return { ok: false, error: INVALID_BAND_ID_MESSAGE };
  }

  // Zod 검증 — 추후 isHeadliner/order 타입 검증을 통일.
  const parsed = liveBandUpsertSchema.safeParse({
    bandId,
    isHeadliner: opts.isHeadliner ?? false,
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Band 존재 확인 (외래키 P2003 보다 명시적 메시지).
  const band = await getBandById(bandId);
  if (!band) {
    return { ok: false, error: BAND_NOT_FOUND_MESSAGE };
  }

  // 현재 라인업 길이로 order 기본값 산출 — 말단 append.
  const current = await listLiveBands(liveId);
  const nextOrder = current.length;

  try {
    await addLiveBand({
      liveId,
      bandId,
      isHeadliner: parsed.data.isHeadliner,
      order: nextOrder,
    });
  } catch (err) {
    console.error("[addLiveBandAction]", err);
    if (isDuplicateLiveBandError(err)) {
      return { ok: false, error: DUPLICATE_BAND_MESSAGE };
    }
    return { ok: false, error: ADD_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${liveId}`);
  return { ok: true };
}

/**
 * LiveBand row 부분 업데이트 (isHeadliner / order).
 */
export async function updateLiveBandAction(
  liveId: number,
  bandId: number,
  patch: { isHeadliner?: boolean; order?: number }
): Promise<LiveBandMutationResult> {
  await requireAdminSession();

  const liveGuard = await guardLive(liveId);
  if (!liveGuard.ok) {
    return liveGuard;
  }
  if (!isPositiveInt(bandId)) {
    return { ok: false, error: INVALID_BAND_ID_MESSAGE };
  }

  // patch 가 비어있어도 멱등 OK — 그러나 schema 일관성 위해 검증한다.
  const sanitized: Record<string, unknown> = { bandId };
  if (patch.isHeadliner !== undefined) {
    sanitized.isHeadliner = patch.isHeadliner;
  }
  if (patch.order !== undefined) {
    sanitized.order = patch.order;
  }
  const parsed = liveBandUpsertSchema.safeParse(sanitized);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const repoPatch: { isHeadliner?: boolean; order?: number } = {};
  if (patch.isHeadliner !== undefined) {
    repoPatch.isHeadliner = parsed.data.isHeadliner;
  }
  if (patch.order !== undefined) {
    repoPatch.order = parsed.data.order;
  }

  try {
    await updateLiveBand(liveId, bandId, repoPatch);
  } catch (err) {
    console.error("[updateLiveBandAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: BAND_NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${liveId}`);
  return { ok: true };
}

/**
 * Live 의 라인업 전체 순서 재정렬.
 *
 * - 빈 배열은 거부.
 * - 다른 라이브에 속한 bandId 가 섞이면 거부 (security).
 */
export async function reorderLiveBandsAction(
  liveId: number,
  orderedBandIds: number[]
): Promise<LiveBandMutationResult> {
  await requireAdminSession();

  const liveGuard = await guardLive(liveId);
  if (!liveGuard.ok) {
    return liveGuard;
  }

  // Zod 가 비어있음/형식 검증.
  const parsed = liveBandReorderSchema.safeParse(orderedBandIds);
  if (!parsed.success) {
    // Zod 에러 메시지를 사용자 친화적으로 묶어서 반환.
    const messages = parsed.error.issues.map((issue) => issue.message);
    return {
      ok: false,
      error: messages[0] ?? REORDER_EMPTY_MESSAGE,
      fieldErrors: { orderedBandIds: messages },
    };
  }

  try {
    await reorderLiveBands(liveId, parsed.data);
  } catch (err) {
    console.error("[reorderLiveBandsAction]", err);
    if (isReorderMismatchError(err)) {
      return { ok: false, error: REORDER_MISMATCH_MESSAGE };
    }
    return { ok: false, error: REORDER_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${liveId}`);
  return { ok: true };
}

/**
 * Live 의 라인업에서 Band 제거. 멱등.
 */
export async function removeLiveBandAction(
  liveId: number,
  bandId: number
): Promise<LiveBandMutationResult> {
  await requireAdminSession();

  const liveGuard = await guardLive(liveId);
  if (!liveGuard.ok) {
    return liveGuard;
  }
  if (!isPositiveInt(bandId)) {
    return { ok: false, error: INVALID_BAND_ID_MESSAGE };
  }

  try {
    await removeLiveBand(liveId, bandId);
  } catch (err) {
    console.error("[removeLiveBandAction]", err);
    return { ok: false, error: REMOVE_FAILURE_MESSAGE };
  }

  revalidatePath(`/admin/lives/${liveId}`);
  return { ok: true };
}
