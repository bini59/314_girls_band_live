"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/guard";
import { fillDefaultTime, jstLocalToUtc } from "@/lib/admin/jst-datetime";
import { liveHeaderCreateSchema } from "@/lib/admin/schemas/live";
import { createLive } from "@/lib/live/repo";
import { ensureDefaultFormat } from "@/lib/live-format/repo";
import { slugify } from "@/lib/slug";

/**
 * Server Action 결과 타입.
 *
 * 성공 경로는 `/admin/lives/{id}` 로 redirect 되어 클라이언트에 닿지 않으므로
 * union 에 success variant 를 두지 않는다.
 */
export type CreateLiveHeaderState =
  | undefined
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Server Action: 라이브 헤더 생성.
 *
 * 흐름:
 *   1. requireAdminSession (실패 시 /admin/login 으로 redirect)
 *   2. FormData → 평문 객체 (빈 문자열 정규화)
 *   3. 시간 필드는 fillDefaultTime 으로 시간 누락 보강
 *   4. Zod 검증 (실패 시 fieldErrors 반환)
 *   5. JST → UTC 변환
 *   6. slug 자동 생성 (slug 빈값 + titleEn 있음) + 중복 처리
 *   7. repo.createLive 호출
 *   8. revalidatePath + redirect
 */
export async function createLiveHeaderAction(
  _prev: CreateLiveHeaderState,
  formData: FormData
): Promise<CreateLiveHeaderState> {
  await requireAdminSession();

  const rawSlug = strOrUndefined(formData.get("slug"));
  const rawTitleEn = strOrUndefined(formData.get("titleEn"));

  const rawInput = {
    titleKo: strOrUndefined(formData.get("titleKo")) ?? "",
    titleJp: strOrUndefined(formData.get("titleJp")) ?? "",
    titleEn: rawTitleEn ?? "",
    type: strOrUndefined(formData.get("type")) ?? "",
    startAtJst: fillDefaultTimeIfPresent(
      strOrUndefined(formData.get("startAtJst")),
      "startAt"
    ),
    doorsOpenAtJst: fillDefaultTimeIfPresent(
      strOrUndefined(formData.get("doorsOpenAtJst")),
      "doorsOpenAt"
    ),
    endAtJst: fillDefaultTimeIfPresent(
      strOrUndefined(formData.get("endAtJst")),
      "endAt"
    ),
    venueName: strOrUndefined(formData.get("venueName")) ?? "",
    venueAddress: strOrUndefined(formData.get("venueAddress")) ?? "",
    venueUrl: strOrUndefined(formData.get("venueUrl")) ?? "",
    slug: rawSlug ?? "",
    notes: strOrUndefined(formData.get("notes")) ?? "",
  };

  // Zod 검증.
  const parsed = liveHeaderCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // slug 결정 — 명시 slug → 사용, 빈값 → slugify(titleEn).
  // titleEn 도 빈값이면 schema 가 이미 fieldErrors.slug 를 반환했어야 한다.
  let baseSlug: string;
  if (data.slug && data.slug.length > 0) {
    baseSlug = data.slug;
  } else if (data.titleEn && data.titleEn.length > 0) {
    baseSlug = slugify(data.titleEn);
    if (!baseSlug) {
      // titleEn 이 비-ASCII 만으로 구성된 경우 — slugify 결과가 비어있을 수 있음.
      return {
        ok: false,
        fieldErrors: {
          slug: ["slug 를 직접 입력해주세요 (titleEn 으로 자동 생성 실패)."],
        },
      };
    }
  } else {
    return {
      ok: false,
      fieldErrors: {
        slug: ["slug 를 직접 입력하거나 titleEn 을 채워주세요."],
      },
    };
  }

  // slug 중복 처리는 repo.createLive 가 단독 책임 (P2002 retry 로 `-2`, `-3`... 부여).
  // JST → UTC 변환.
  const startAtUtc = jstLocalToUtc(data.startAtJst);
  const doorsOpenAtUtc = data.doorsOpenAtJst
    ? jstLocalToUtc(data.doorsOpenAtJst)
    : null;
  const endAtUtc = data.endAtJst ? jstLocalToUtc(data.endAtJst) : null;

  const created = await createLive({
    slug: baseSlug,
    titleKo: data.titleKo,
    titleJp: data.titleJp,
    titleEn: data.titleEn && data.titleEn.length > 0 ? data.titleEn : null,
    type: data.type,
    startAt: startAtUtc,
    doorsOpenAt: doorsOpenAtUtc,
    endAt: endAtUtc,
    venueName: data.venueName,
    venueAddress:
      data.venueAddress && data.venueAddress.length > 0
        ? data.venueAddress
        : null,
    venueUrl:
      data.venueUrl && data.venueUrl.length > 0 ? data.venueUrl : null,
    notes: data.notes && data.notes.length > 0 ? data.notes : null,
  });

  // 기본 LIVE_VENUE 포맷을 자동 등록 (best-effort).
  //   - 컨벤션상 Live 1건당 LIVE_VENUE 1개 이상이 있어야 한다.
  //   - 실패해도 라이브 자체 생성은 성공으로 간주 (포맷은 어드민이 수동으로 추가 가능).
  try {
    await ensureDefaultFormat(created.id);
  } catch (err) {
    console.error("[createLiveHeaderAction:ensureDefaultFormat]", err);
  }

  revalidatePath("/admin/lives");
  redirect(`/admin/lives/${created.id}`);
}

/** FormData get 의 결과를 string|undefined 로 정규화. */
function strOrUndefined(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  return v;
}

/**
 * fillDefaultTime 의 wrapper:
 *  - undefined 면 undefined 반환 (zod optional 처리).
 *  - "" 빈 문자열도 undefined 처리 (사용자가 명시적으로 비웠을 수 있음).
 *  - 그 외엔 시간 누락 보강.
 */
function fillDefaultTimeIfPresent(
  v: string | undefined,
  field: Parameters<typeof fillDefaultTime>[1]
): string | undefined {
  if (v === undefined || v === "") return undefined;
  return fillDefaultTime(v, field);
}
