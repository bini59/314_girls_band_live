"use server";

/**
 * TicketSale (판매/추첨 라운드) Server Actions.
 *
 * 흐름:
 *  1. requireAdminSession (인증)
 *  2. 양의 정수 검증 (liveId / saleId)
 *  3. JST datetime 필드별 기본 시각 보강 (fillDefaultTime)
 *  4. zod schema 로 검증 (실패 → fieldErrors 반환)
 *  5. JST → UTC 변환 후 repo 호출
 *  6. revalidatePath("/admin/lives") + 직렬화된 sale 반환
 *
 * 컨벤션:
 *  - tier 링크 변경은 createTicketSaleAction (생성 시 atomic) 과
 *    setTicketSaleTiersAction (이후 갱신) 만 수행한다.
 *  - updateTicketSaleAction 은 메타 필드만. tier 링크는 건드리지 않음.
 *  - cross-live tier 가드는 repo 레벨에서 강제 (트랜잭션 rollback).
 *  - 빈 optional 문자열은 null 로 저장.
 *
 * 모든 메시지/주석 한국어.
 */
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guard";
import { fillDefaultTime, jstLocalToUtc } from "@/lib/admin/jst-datetime";
import {
  ticketSaleCreateSchema,
  ticketSaleUpdateSchema,
  setTicketSaleTiersSchema,
  type TicketSaleTypeInput,
  type TicketSaleMethodInput,
} from "@/lib/admin/schemas/ticket-sale";
import {
  createTicketSale,
  deleteTicketSale,
  getSaleLiveId,
  setTicketSaleTiers,
  updateTicketSale,
  type UpdateTicketSalePatch,
} from "@/lib/ticket-sale/repo";
import { getLiveById } from "@/lib/live/repo";

// ---------------------------------------------------------------------------
// 타입.
// ---------------------------------------------------------------------------

/**
 * 폼이 전달하는 raw 입력. JST datetime-local 문자열.
 *
 * - startsAtJst 는 create 시 필수, update 시 optional.
 * - 빈 문자열은 "값 없음" 의미. 서버에서 null 또는 무시로 처리.
 */
export type TicketSaleFormInput = {
  vendorId?: number;
  type?: TicketSaleTypeInput;
  method?: TicketSaleMethodInput;
  label?: string;
  startsAtJst?: string;
  endsAtJst?: string;
  announceAtJst?: string;
  paymentDeadlineAtJst?: string;
  url?: string;
  notes?: string;
  tierIds?: number[];
};

/**
 * 직렬화된 TicketSale (클라이언트에 전달 가능한 일반 객체).
 *
 * - 시각은 ISO 문자열 (UTC).
 * - tiers/vendor 는 nested.
 */
export type SerializedTicketSale = {
  id: number;
  liveId: number;
  vendorId: number;
  vendor: { id: number; name: string; slug: string };
  type: TicketSaleTypeInput;
  method: TicketSaleMethodInput;
  label: string | null;
  startsAt: string;
  endsAt: string | null;
  announceAt: string | null;
  paymentDeadlineAt: string | null;
  url: string | null;
  notes: string | null;
  tiers: Array<{ id: number; name: string; priceJpy: number; formatId: number }>;
};

/** 액션 응답: discriminated union. */
export type TicketSaleActionResult =
  | { ok: true; sale?: SerializedTicketSale }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// 메시지 상수.
// ---------------------------------------------------------------------------

const INVALID_LIVE_ID_MESSAGE = "유효하지 않은 라이브 ID 입니다.";
const INVALID_SALE_ID_MESSAGE = "유효하지 않은 라운드 ID 입니다.";
const NOT_FOUND_LIVE_MESSAGE = "이미 삭제된 라이브입니다.";
const NOT_FOUND_SALE_MESSAGE = "라운드를 찾을 수 없습니다.";
const FOREIGN_TIER_MESSAGE =
  "선택한 티어가 본 라이브에 속하지 않습니다. 다시 확인해주세요.";
const FOREIGN_VENDOR_MESSAGE = "선택한 발매처를 찾을 수 없습니다.";
const CREATE_FAILURE_MESSAGE = "라운드 등록에 실패했습니다.";
const UPDATE_FAILURE_MESSAGE = "라운드 수정에 실패했습니다.";
const DELETE_FAILURE_MESSAGE = "라운드 삭제에 실패했습니다.";
const SET_TIERS_FAILURE_MESSAGE = "티어 매핑 갱신에 실패했습니다.";

// ---------------------------------------------------------------------------
// 헬퍼.
// ---------------------------------------------------------------------------

function isValidPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

/** repo 가 throw 하는 "본 라이브에 속하지 않는 티어" 패턴 매칭. */
function isForeignTierError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("본 라이브") &&
    err.message.includes("속하지 않")
  );
}

/** repo 의 "찾을 수 없" / "삭제됨" 패턴. */
function isNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("찾을 수 없") || err.message.includes("삭제됨"))
  );
}

/** Prisma P2003 (FK 위배) 판별 — vendor / live 외래키 누락. */
function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2003"
  );
}

/**
 * JST 시각 필드 4종에 대해 fillDefaultTime 을 적용해 정규화.
 *
 * - 빈 문자열은 그대로 유지 (사용자가 의도적으로 비웠을 수 있음).
 * - undefined 는 건드리지 않음.
 */
function normalizeJstFields<T extends TicketSaleFormInput>(input: T): T {
  const next: T = { ...input };
  if (next.startsAtJst !== undefined && next.startsAtJst !== "") {
    next.startsAtJst = fillDefaultTime(next.startsAtJst, "saleStart");
  }
  if (next.endsAtJst !== undefined && next.endsAtJst !== "") {
    next.endsAtJst = fillDefaultTime(next.endsAtJst, "saleEnd");
  }
  if (next.announceAtJst !== undefined && next.announceAtJst !== "") {
    next.announceAtJst = fillDefaultTime(next.announceAtJst, "announceAt");
  }
  if (
    next.paymentDeadlineAtJst !== undefined &&
    next.paymentDeadlineAtJst !== ""
  ) {
    next.paymentDeadlineAtJst = fillDefaultTime(
      next.paymentDeadlineAtJst,
      "paymentDeadline"
    );
  }
  return next;
}

/**
 * 직렬화 — Date → ISO 문자열로 평탄화한다.
 *
 * 클라이언트가 새 Date 객체를 만들면 표시 시점에 호스트 TZ 영향을 받으므로,
 * `lib/admin/format-jst.ts` 의 `formatJstDateTime()` 이 ISO 문자열을 직접 받는다.
 */
function serializeSale(sale: {
  id: number;
  liveId: number;
  vendorId: number;
  vendor: { id: number; name: string; slug: string };
  type: TicketSaleTypeInput;
  method: TicketSaleMethodInput;
  label: string | null;
  startsAt: Date;
  endsAt: Date | null;
  announceAt: Date | null;
  paymentDeadlineAt: Date | null;
  url: string | null;
  notes: string | null;
  tiers: Array<{ id: number; name: string; priceJpy: number; formatId: number }>;
}): SerializedTicketSale {
  return {
    id: sale.id,
    liveId: sale.liveId,
    vendorId: sale.vendorId,
    vendor: {
      id: sale.vendor.id,
      name: sale.vendor.name,
      slug: sale.vendor.slug,
    },
    type: sale.type,
    method: sale.method,
    label: sale.label,
    startsAt: sale.startsAt.toISOString(),
    endsAt: sale.endsAt ? sale.endsAt.toISOString() : null,
    announceAt: sale.announceAt ? sale.announceAt.toISOString() : null,
    paymentDeadlineAt: sale.paymentDeadlineAt
      ? sale.paymentDeadlineAt.toISOString()
      : null,
    url: sale.url,
    notes: sale.notes,
    tiers: sale.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      priceJpy: t.priceJpy,
      formatId: t.formatId,
    })),
  };
}

// ---------------------------------------------------------------------------
// createTicketSaleAction
// ---------------------------------------------------------------------------

/**
 * 라운드 생성.
 *
 * - tierIds 가 있으면 createTicketSale (repo) 가 atomic 으로 cross-live 검증 + insert + link.
 * - 한 tierId 라도 cross-live 면 트랜잭션 전체 rollback. 사용자에게 fieldErrors.tierIds 로 안내.
 */
export async function createTicketSaleAction(
  liveId: number,
  input: TicketSaleFormInput
): Promise<TicketSaleActionResult> {
  await requireAdminSession();

  if (!isValidPositiveInt(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }

  // soft-deleted 라이브에는 추가할 수 없다.
  const live = await getLiveById(liveId);
  if (!live) {
    return { ok: false, error: NOT_FOUND_LIVE_MESSAGE };
  }

  const normalized = normalizeJstFields(input);

  // schema 가 빈 문자열을 optional 로 받아준다. undefined 는 건너뜀.
  const candidate: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    candidate[k] = v;
  }

  const parsed = ticketSaleCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // JST → UTC 변환.
  const startsAt = jstLocalToUtc(data.startsAtJst);
  const endsAt =
    data.endsAtJst && data.endsAtJst !== ""
      ? jstLocalToUtc(data.endsAtJst)
      : null;
  const announceAt =
    data.announceAtJst && data.announceAtJst !== ""
      ? jstLocalToUtc(data.announceAtJst)
      : null;
  const paymentDeadlineAt =
    data.paymentDeadlineAtJst && data.paymentDeadlineAtJst !== ""
      ? jstLocalToUtc(data.paymentDeadlineAtJst)
      : null;

  try {
    const sale = await createTicketSale({
      liveId,
      vendorId: data.vendorId,
      type: data.type,
      method: data.method,
      label: data.label && data.label.length > 0 ? data.label : null,
      startsAt,
      endsAt,
      announceAt,
      paymentDeadlineAt,
      url: data.url && data.url.length > 0 ? data.url : null,
      notes: data.notes && data.notes.length > 0 ? data.notes : null,
      tierIds: data.tierIds ?? [],
    });

    revalidatePath("/admin/lives");
    return { ok: true, sale: serializeSale(sale) };
  } catch (err) {
    console.error("[createTicketSaleAction]", err);
    if (isForeignTierError(err)) {
      return {
        ok: false,
        fieldErrors: { tierIds: [FOREIGN_TIER_MESSAGE] },
      };
    }
    if (isForeignKeyViolation(err)) {
      return {
        ok: false,
        fieldErrors: { vendorId: [FOREIGN_VENDOR_MESSAGE] },
      };
    }
    return { ok: false, error: CREATE_FAILURE_MESSAGE };
  }
}

// ---------------------------------------------------------------------------
// updateTicketSaleAction
// ---------------------------------------------------------------------------

/**
 * 라운드 메타 부분 수정. tier 링크는 건드리지 않음 (setTicketSaleTiersAction 별도).
 */
export async function updateTicketSaleAction(
  saleId: number,
  patch: Partial<TicketSaleFormInput>
): Promise<TicketSaleActionResult> {
  await requireAdminSession();

  if (!isValidPositiveInt(saleId)) {
    return { ok: false, error: INVALID_SALE_ID_MESSAGE };
  }

  // 소속 라이브 확인 (soft-deleted 라이브의 sale 은 거부).
  const ownerLiveId = await getSaleLiveId(saleId);
  if (ownerLiveId === null) {
    return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
  }
  const live = await getLiveById(ownerLiveId);
  if (!live) {
    return { ok: false, error: NOT_FOUND_LIVE_MESSAGE };
  }

  // tierIds 는 update 스키마가 다루지 않으므로 명시적으로 제거.
  const { tierIds: _ignored, ...rest } = patch;
  void _ignored;
  const normalized = normalizeJstFields(rest);

  const candidate: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    candidate[k] = v;
  }

  const parsed = ticketSaleUpdateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // patch 구성 (전송된 필드만).
  const repoPatch: UpdateTicketSalePatch = {};
  if (data.vendorId !== undefined) repoPatch.vendorId = data.vendorId;
  if (data.type !== undefined) repoPatch.type = data.type;
  if (data.method !== undefined) repoPatch.method = data.method;
  if (data.label !== undefined) {
    repoPatch.label = data.label.length === 0 ? null : data.label;
  }
  if (data.startsAtJst !== undefined && data.startsAtJst !== "") {
    repoPatch.startsAt = jstLocalToUtc(data.startsAtJst);
  }
  if (data.endsAtJst !== undefined) {
    repoPatch.endsAt =
      data.endsAtJst === "" ? null : jstLocalToUtc(data.endsAtJst);
  }
  if (data.announceAtJst !== undefined) {
    repoPatch.announceAt =
      data.announceAtJst === "" ? null : jstLocalToUtc(data.announceAtJst);
  }
  if (data.paymentDeadlineAtJst !== undefined) {
    repoPatch.paymentDeadlineAt =
      data.paymentDeadlineAtJst === ""
        ? null
        : jstLocalToUtc(data.paymentDeadlineAtJst);
  }
  if (data.url !== undefined) {
    repoPatch.url = data.url.length === 0 ? null : data.url;
  }
  if (data.notes !== undefined) {
    repoPatch.notes = data.notes.length === 0 ? null : data.notes;
  }

  try {
    await updateTicketSale(saleId, repoPatch);
  } catch (err) {
    console.error("[updateTicketSaleAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
    }
    if (isForeignKeyViolation(err)) {
      return {
        ok: false,
        fieldErrors: { vendorId: [FOREIGN_VENDOR_MESSAGE] },
      };
    }
    return { ok: false, error: UPDATE_FAILURE_MESSAGE };
  }

  revalidatePath("/admin/lives");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setTicketSaleTiersAction
// ---------------------------------------------------------------------------

/**
 * tier 매핑 일괄 교체.
 *
 * - 빈 배열 허용 (모든 매핑 제거).
 * - cross-live 가드는 repo 가 트랜잭션 내에서 강제.
 */
export async function setTicketSaleTiersAction(
  saleId: number,
  tierIds: number[]
): Promise<TicketSaleActionResult> {
  await requireAdminSession();

  if (!isValidPositiveInt(saleId)) {
    return { ok: false, error: INVALID_SALE_ID_MESSAGE };
  }

  // 소유 라이브 검증 (soft-deleted 보호).
  const ownerLiveId = await getSaleLiveId(saleId);
  if (ownerLiveId === null) {
    return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
  }
  const live = await getLiveById(ownerLiveId);
  if (!live) {
    return { ok: false, error: NOT_FOUND_LIVE_MESSAGE };
  }

  const parsed = setTicketSaleTiersSchema.safeParse(tierIds);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: { tierIds: parsed.error.flatten().formErrors },
    };
  }

  try {
    await setTicketSaleTiers(saleId, parsed.data);
  } catch (err) {
    console.error("[setTicketSaleTiersAction]", err);
    if (isForeignTierError(err)) {
      return {
        ok: false,
        fieldErrors: { tierIds: [FOREIGN_TIER_MESSAGE] },
      };
    }
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
    }
    return { ok: false, error: SET_TIERS_FAILURE_MESSAGE };
  }

  revalidatePath("/admin/lives");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deleteTicketSaleAction
// ---------------------------------------------------------------------------

/**
 * 라운드 삭제. TicketSaleTier 는 cascade.
 *
 * - 멱등성은 보장하지 않는다 (repo 가 not-found → throw).
 *   클라이언트에서 두 번 삭제 시도 시 두 번째는 NOT_FOUND_SALE_MESSAGE 응답.
 */
export async function deleteTicketSaleAction(
  saleId: number
): Promise<TicketSaleActionResult> {
  await requireAdminSession();

  if (!isValidPositiveInt(saleId)) {
    return { ok: false, error: INVALID_SALE_ID_MESSAGE };
  }

  // 소유 라이브 검증.
  const ownerLiveId = await getSaleLiveId(saleId);
  if (ownerLiveId === null) {
    return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
  }
  const live = await getLiveById(ownerLiveId);
  if (!live) {
    return { ok: false, error: NOT_FOUND_LIVE_MESSAGE };
  }

  try {
    await deleteTicketSale(saleId);
  } catch (err) {
    console.error("[deleteTicketSaleAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_SALE_MESSAGE };
    }
    return { ok: false, error: DELETE_FAILURE_MESSAGE };
  }

  revalidatePath("/admin/lives");
  return { ok: true };
}
