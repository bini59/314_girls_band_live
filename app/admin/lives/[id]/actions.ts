"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import { fillDefaultTime, jstLocalToUtc } from "@/lib/admin/jst-datetime";
import { liveHeaderUpdateSchema } from "@/lib/admin/schemas/live";
import {
  getLiveById,
  publishLive,
  unpublishLive,
  updateLive,
  type UpdateLiveInput,
} from "@/lib/live/repo";

/**
 * 자동저장 응답 형식.
 *
 * - 성공: `{ ok: true, savedAt: ISO }`
 * - 실패: `{ ok: false, error?, fieldErrors? }`
 *
 * `savedAt` 은 클라이언트 stale-guard 보조 용도. 서버 시간 ISO 8601.
 */
export type UpdateLiveHeaderResult =
  | { ok: true; savedAt: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type PublishLiveResult =
  | { ok: true }
  | { ok: false; error?: string; gateFailures?: string[] };

/** 자동저장 입력 — 클라이언트에서 부분 patch 형태로 전달. */
export type UpdateLiveHeaderInput = Partial<{
  titleKo: string;
  titleJp: string;
  titleEn: string;
  type: "SOLO" | "TAIBAN" | "FES";
  startAtJst: string;
  doorsOpenAtJst: string;
  endAtJst: string;
  venueName: string;
  venueAddress: string;
  venueUrl: string;
  slug: string;
  notes: string;
}>;

const INVALID_LIVE_ID_MESSAGE = "유효하지 않은 라이브 ID 입니다.";
const NOT_FOUND_MESSAGE = "이미 삭제된 라이브입니다.";
const UPDATE_FAILURE_MESSAGE = "라이브 업데이트에 실패했습니다.";
const PUBLISH_FAILURE_MESSAGE = "라이브 공개에 실패했습니다.";
const UNPUBLISH_FAILURE_MESSAGE = "라이브 비공개 전환에 실패했습니다.";
const SLUG_TAKEN_MESSAGE = "이미 사용 중인 slug 입니다.";

/** Prisma 의 P2002 (unique constraint) 인지 판별. */
function isUniqueViolation(
  err: unknown
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** repo 의 "찾지 못함" 에러 메시지 패턴 매칭 (현재 lib/live/repo.ts 의 throw 메시지). */
function isNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("찾을 수 없") || err.message.includes("삭제됨"))
  );
}

/** liveId 가 양의 정수인지 검증. */
function isValidLiveId(liveId: unknown): liveId is number {
  return (
    typeof liveId === "number" && Number.isInteger(liveId) && liveId > 0
  );
}

/**
 * Server Action: 라이브 헤더 부분 업데이트 (자동저장).
 *
 * - 인증 → 검증 → JST→UTC 변환 → updateLive → revalidatePath.
 * - 부분 patch: 보낸 필드만 검증/적용.
 */
export async function updateLiveHeaderAction(
  liveId: number,
  input: UpdateLiveHeaderInput
): Promise<UpdateLiveHeaderResult> {
  await requireAdminSession();

  if (!isValidLiveId(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }

  // 시간 필드 보강 (date-only → 기본 시간 부착).
  const normalized: UpdateLiveHeaderInput = { ...input };
  if (normalized.startAtJst !== undefined && normalized.startAtJst !== "") {
    normalized.startAtJst = fillDefaultTime(normalized.startAtJst, "startAt");
  }
  if (
    normalized.doorsOpenAtJst !== undefined &&
    normalized.doorsOpenAtJst !== ""
  ) {
    normalized.doorsOpenAtJst = fillDefaultTime(
      normalized.doorsOpenAtJst,
      "doorsOpenAt"
    );
  }
  if (normalized.endAtJst !== undefined && normalized.endAtJst !== "") {
    normalized.endAtJst = fillDefaultTime(normalized.endAtJst, "endAt");
  }

  // 빈 문자열을 schema 에 그대로 넘기면 형식 검증에서 거부될 수 있으므로
  // optional 필드의 빈값은 undefined 로 정리.
  // 단 titleKo/titleJp/venueName 의 빈값은 schema 가 거부해야 한다.
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    sanitized[k] = v;
  }

  const parsed = liveHeaderUpdateSchema.safeParse(sanitized);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // patch 구성.
  const patch: UpdateLiveInput = {};
  if (data.titleKo !== undefined) patch.titleKo = data.titleKo;
  if (data.titleJp !== undefined) patch.titleJp = data.titleJp;
  if (data.titleEn !== undefined) {
    patch.titleEn = data.titleEn.length === 0 ? null : data.titleEn;
  }
  if (data.type !== undefined) patch.type = data.type;
  if (data.startAtJst !== undefined) {
    patch.startAt = jstLocalToUtc(data.startAtJst);
  }
  if (data.doorsOpenAtJst !== undefined) {
    patch.doorsOpenAt = data.doorsOpenAtJst
      ? jstLocalToUtc(data.doorsOpenAtJst)
      : null;
  }
  if (data.endAtJst !== undefined) {
    patch.endAt = data.endAtJst ? jstLocalToUtc(data.endAtJst) : null;
  }
  if (data.venueName !== undefined) patch.venueName = data.venueName;
  if (data.venueAddress !== undefined) {
    patch.venueAddress =
      data.venueAddress.length === 0 ? null : data.venueAddress;
  }
  if (data.venueUrl !== undefined) {
    patch.venueUrl = data.venueUrl.length === 0 ? null : data.venueUrl;
  }
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.notes !== undefined) {
    patch.notes = data.notes.length === 0 ? null : data.notes;
  }

  try {
    await updateLive(liveId, patch);
  } catch (err) {
    // 원본 에러는 서버 로그에만. 사용자에게는 일반화된 메시지.
    console.error("[updateLiveHeaderAction]", err);
    if (isUniqueViolation(err)) {
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

  revalidatePath("/admin/lives");
  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Server Action: 라이브 공개.
 *
 * 본 사이클 한정 가정 (TODO.md):
 *  - 헤더 필수 필드(titleKo / titleJp / type / startAt / venueName) 만 검증.
 *  - LiveBand 1개 이상 검증은 다음 사이클에서 활성화.
 *
 * TODO(cycle-C): LiveBand >= 1 검증 활성화.
 */
export async function publishLiveAction(
  liveId: number
): Promise<PublishLiveResult> {
  await requireAdminSession();

  if (!isValidLiveId(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }

  const live = await getLiveById(liveId);
  if (!live) {
    return { ok: false, error: NOT_FOUND_MESSAGE };
  }

  // 헤더 필수 필드 게이트.
  const gateFailures: string[] = [];
  if (!live.titleKo || live.titleKo.length === 0) gateFailures.push("titleKo");
  if (!live.titleJp || live.titleJp.length === 0) gateFailures.push("titleJp");
  if (!live.type) gateFailures.push("type");
  if (!live.startAt) gateFailures.push("startAt");
  if (!live.venueName || live.venueName.length === 0) {
    gateFailures.push("venueName");
  }

  // TODO(cycle-C): LiveBand >= 1 검증 활성화.
  //   const bands = await prisma.liveBand.findMany({ where: { liveId } });
  //   if (bands.length === 0) gateFailures.push("liveBand");

  if (gateFailures.length > 0) {
    return { ok: false, gateFailures };
  }

  try {
    await publishLive(liveId);
  } catch (err) {
    console.error("[publishLiveAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: PUBLISH_FAILURE_MESSAGE };
  }

  revalidatePath("/admin/lives");
  return { ok: true };
}

/**
 * Server Action: 라이브 비공개.
 *
 * 헤더 검증 없이 무조건 DRAFT 로 전환 (멱등).
 */
export async function unpublishLiveAction(
  liveId: number
): Promise<PublishLiveResult> {
  await requireAdminSession();

  if (!isValidLiveId(liveId)) {
    return { ok: false, error: INVALID_LIVE_ID_MESSAGE };
  }

  try {
    await unpublishLive(liveId);
  } catch (err) {
    console.error("[unpublishLiveAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: UNPUBLISH_FAILURE_MESSAGE };
  }

  revalidatePath("/admin/lives");
  return { ok: true };
}
