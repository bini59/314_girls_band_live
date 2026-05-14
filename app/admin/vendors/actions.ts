"use server";

/**
 * `/admin/vendors` Server Actions — 발매처 마스터 관리.
 *
 * 책임:
 *  - 어드민 세션 강제 (`requireAdminSession`).
 *  - 입력 검증 (Zod: vendorCreateSchema / vendorUpdateSchema).
 *  - 도메인 repo (`lib/vendors/repo`) 호출.
 *  - mutation 성공 시 `/admin/vendors` 및 `/admin/lives` 재검증
 *    (라이브의 판매 라운드에서 vendor 드롭다운을 사용하므로).
 *
 * 응답 형식 (discriminated union):
 *  - 성공: `{ ok: true, vendor }` 또는 `{ ok: true }`
 *  - 실패: `{ ok: false, error?, fieldErrors? }`
 *
 * 에러 매핑:
 *  - P2002 (slug unique) → fieldError `slug: ["이미 사용 중인 slug 입니다."]`.
 *  - P2003 (TicketSale 가 참조 중) → error 메시지 "사용 중인 발매처는 삭제할 수 없습니다.".
 *  - not-found → error "이미 삭제된 발매처입니다.".
 *
 * 모든 사용자향 메시지는 한국어.
 */

import { revalidatePath } from "next/cache";
import type { Vendor } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import {
  vendorCreateSchema,
  vendorUpdateSchema,
} from "@/lib/admin/schemas/vendor";
import {
  createVendor,
  deleteVendor,
  updateVendor,
} from "@/lib/vendors/repo";

// =====================================================================
// 응답 타입
// =====================================================================

export type VendorMutationResult =
  | { ok: true; vendor: Vendor }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type VendorDeleteResult =
  | { ok: true }
  | { ok: false; error?: string };

// =====================================================================
// 메시지 상수
// =====================================================================

const INVALID_VENDOR_ID_MESSAGE = "유효하지 않은 발매처 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 발매처입니다.";
const CREATE_FAILURE_MESSAGE = "발매처 생성에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "발매처 업데이트에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "발매처 삭제에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";
const VENDOR_IN_USE_MESSAGE = "사용 중인 발매처는 삭제할 수 없습니다.";

// =====================================================================
// 헬퍼
// =====================================================================

/** vendorId 가 양의 정수인지 검증. */
function isValidVendorId(vendorId: unknown): vendorId is number {
  return (
    typeof vendorId === "number" &&
    Number.isInteger(vendorId) &&
    vendorId > 0
  );
}

/** Prisma P2002 (slug unique violation) 또는 repo 의 "이미 사용 중인 slug" 메시지 판별. */
function isSlugTakenError(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return true;
  }
  return (
    err instanceof Error && err.message.includes("이미 사용 중인 slug")
  );
}

/** repo 의 "사용 중인 발매처는 삭제할 수 없습니다" 메시지 판별 (P2003 매핑). */
function isVendorInUseError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("사용 중인 발매처는 삭제할 수 없습니다")
  );
}

/** repo 의 "찾을 수 없" 메시지 판별 (P2025 매핑). */
function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("찾을 수 없");
}

/** mutation 성공 시 영향받는 경로 재검증. */
function revalidateAffectedPaths(): void {
  revalidatePath("/admin/vendors");
  // 라이브 페이지의 판매 라운드 드롭다운이 vendor 목록에 의존.
  revalidatePath("/admin/lives");
}

// =====================================================================
// Server Actions
// =====================================================================

export type CreateVendorInput = {
  slug: string;
  name: string;
  baseUrl?: string;
  logoUrl?: string;
  notes?: string;
};

/**
 * Vendor 생성.
 *
 * - Zod 검증 (slug kebab-case / 필수 / 길이 / URL 형식).
 * - 빈 문자열 옵션 필드는 null 로 저장.
 * - P2002 (slug 중복) → fieldErrors.slug.
 */
export async function createVendorAction(
  input: CreateVendorInput
): Promise<VendorMutationResult> {
  await requireAdminSession();

  const parsed = vendorCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const vendor = await createVendor({
      slug: data.slug,
      name: data.name,
      baseUrl: data.baseUrl && data.baseUrl.length > 0 ? data.baseUrl : null,
      logoUrl: data.logoUrl && data.logoUrl.length > 0 ? data.logoUrl : null,
      notes: data.notes && data.notes.length > 0 ? data.notes : null,
    });
    revalidateAffectedPaths();
    return { ok: true, vendor };
  } catch (err) {
    console.error("[createVendorAction]", err);
    if (isSlugTakenError(err)) {
      return {
        ok: false,
        fieldErrors: { slug: [SLUG_TAKEN_MESSAGE] },
      };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

export type UpdateVendorPatch = Partial<{
  slug: string;
  name: string;
  baseUrl: string;
  logoUrl: string;
  notes: string;
}>;

/**
 * Vendor 부분 업데이트.
 *
 * - vendorUpdateSchema (partial) 적용.
 * - 빈 문자열 옵션 필드는 null 로 저장.
 * - P2002 → fieldErrors.slug.
 * - not-found → error.
 */
export async function updateVendorAction(
  vendorId: number,
  patch: UpdateVendorPatch
): Promise<VendorMutationResult> {
  await requireAdminSession();

  if (!isValidVendorId(vendorId)) {
    return { ok: false, error: INVALID_VENDOR_ID_MESSAGE };
  }

  const parsed = vendorUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const repoPatch: {
    slug?: string;
    name?: string;
    baseUrl?: string | null;
    logoUrl?: string | null;
    notes?: string | null;
  } = {};
  if (data.slug !== undefined) repoPatch.slug = data.slug;
  if (data.name !== undefined) repoPatch.name = data.name;
  if (data.baseUrl !== undefined) {
    repoPatch.baseUrl = data.baseUrl.length === 0 ? null : data.baseUrl;
  }
  if (data.logoUrl !== undefined) {
    repoPatch.logoUrl = data.logoUrl.length === 0 ? null : data.logoUrl;
  }
  if (data.notes !== undefined) {
    repoPatch.notes = data.notes.length === 0 ? null : data.notes;
  }

  try {
    const vendor = await updateVendor(vendorId, repoPatch);
    revalidateAffectedPaths();
    return { ok: true, vendor };
  } catch (err) {
    console.error("[updateVendorAction]", err);
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

/**
 * Vendor 삭제.
 *
 * - P2003 (TicketSale 가 참조) → "사용 중인 발매처는 삭제할 수 없습니다.".
 * - not-found → error.
 */
export async function deleteVendorAction(
  vendorId: number
): Promise<VendorDeleteResult> {
  await requireAdminSession();

  if (!isValidVendorId(vendorId)) {
    return { ok: false, error: INVALID_VENDOR_ID_MESSAGE };
  }

  try {
    await deleteVendor(vendorId);
    revalidateAffectedPaths();
    return { ok: true };
  } catch (err) {
    console.error("[deleteVendorAction]", err);
    if (isVendorInUseError(err)) {
      return { ok: false, error: VENDOR_IN_USE_MESSAGE };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }
}
