/**
 * Live 헤더 등록·편집 입력 검증 (Zod).
 *
 * - 모든 datetime-local 필드는 JST `YYYY-MM-DDTHH:mm` 형식으로 받는다.
 *   regex 통과 후 의미상 유효성(`new Date()` 의 `isNaN`)을 superRefine 으로 보강한다.
 * - 시간 관계 (`doorsOpenAt < startAt`, `endAt > startAt`) 도 superRefine 으로 검증.
 * - slug 는 kebab-case (`^[a-z0-9-]+$`). 빈값일 때 titleEn 까지 비어있으면 거부.
 * - liveHeaderCreateSchema: 신규 라이브용 (필수 필드 포함)
 * - liveHeaderUpdateSchema: 편집 자동저장용 (모든 필드 optional, 단 입력된 값은 동일 검증)
 */
import { z } from "zod";

/**
 * JST datetime-local 형식 (`YYYY-MM-DDTHH:mm`) 정규식.
 *
 * - 4자리 연도 + `-` + 2자리 월 + `-` + 2자리 일 + `T` + 2자리 시 + `:` + 2자리 분
 * - 초/ms 불허, 공백 구분자 불허
 *
 * regex 만으로는 `2026-13-99T25:99` 같은 의미상 무효도 통과시킬 수 있으므로
 * 호출자가 `new Date()` 검증을 추가로 수행해야 한다.
 */
export const JST_DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Slug 형식: kebab-case ASCII (대문자/언더스코어/공백 불허). */
const SLUG_REGEX = /^[a-z0-9-]+$/;

/** LiveType enum — Prisma schema 와 동일. */
export const liveTypeSchema = z.enum(["SOLO", "TAIBAN", "FES"]);
export type LiveTypeInput = z.infer<typeof liveTypeSchema>;

/**
 * JST datetime-local 문자열 zod 스키마.
 *
 * 1) regex 검증
 * 2) 의미상 유효성: `new Date(${value}:00+09:00)` 가 NaN 이 아닌지
 *
 * 빈 문자열은 허용하지 않는다 — 호출자가 optional 처리.
 */
const jstDateTimeLocalString = z
  .string()
  .regex(JST_DATETIME_LOCAL_REGEX, {
    message:
      "JST datetime-local 형식이어야 합니다 (YYYY-MM-DDTHH:mm).",
  })
  .superRefine((val, ctx) => {
    // 의미상 유효 (regex 만으로는 2026-13-99T25:99 같은 입력을 못 거름).
    const d = new Date(`${val}:00+09:00`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "유효한 날짜/시간이 아닙니다.",
      });
      return;
    }
    // 추가 검증: `2026-02-30T18:00` 처럼 JS Date 가 보정해버리는 경우 차단.
    // toISOString 의 앞부분이 입력과 다르면 보정된 것이므로 거부.
    // JST → UTC 변환 후 다시 JST 로 환산하여 비교.
    const shiftedToJst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const echo = shiftedToJst.toISOString().slice(0, 16);
    if (echo !== val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "유효한 날짜/시간이 아닙니다.",
      });
    }
  });

/**
 * 공통 필드 스키마 (create 와 update 가 공유).
 * update 는 .partial() 로 모든 필드를 optional 화한다.
 */
const baseLiveFields = z.object({
  titleKo: z.string().min(1, "필수 입력 항목입니다.").max(200),
  titleJp: z.string().min(1, "필수 입력 항목입니다.").max(200),
  titleEn: z.string().max(200).optional(),
  type: liveTypeSchema,
  startAtJst: jstDateTimeLocalString,
  // optional datetime 필드는 폼이 빈 문자열("")을 보낼 수 있으므로 명시적 허용.
  // 액션 레이어에서 빈 문자열은 null/undefined 로 정규화한다.
  doorsOpenAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  endAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  venueName: z.string().min(1, "필수 입력 항목입니다.").max(200),
  venueAddress: z.string().max(500).optional(),
  venueUrl: z.string().url("올바른 URL 이 아닙니다.").max(500).optional().or(z.literal("")),
  slug: z.string().optional(),
  notes: z.string().max(10000).optional(),
});

/**
 * 시간 관계 검증 (doorsOpenAt < startAt, endAt > startAt) 헬퍼.
 *
 * value 는 superRefine 의 input. start/doors/end 가 모두 있을 때만 비교.
 */
function refineTimeRelations(
  value: {
    startAtJst?: string;
    doorsOpenAtJst?: string;
    endAtJst?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!value.startAtJst) return;
  const start = new Date(`${value.startAtJst}:00+09:00`).getTime();
  if (Number.isNaN(start)) return;

  if (value.doorsOpenAtJst) {
    const doors = new Date(`${value.doorsOpenAtJst}:00+09:00`).getTime();
    if (!Number.isNaN(doors) && doors >= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["doorsOpenAtJst"],
        message: "개장 시간은 개연 시간보다 빨라야 합니다.",
      });
    }
  }
  if (value.endAtJst) {
    const end = new Date(`${value.endAtJst}:00+09:00`).getTime();
    if (!Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAtJst"],
        message: "종료 시간은 개연 시간보다 늦어야 합니다.",
      });
    }
  }
}

/**
 * 생성용 스키마.
 *
 * 필수 필드: titleKo, titleJp, type, startAtJst, venueName
 * 선택 필드: titleEn, slug, doorsOpenAtJst, endAtJst, venueAddress, venueUrl, notes
 *
 * slug 자동 생성 규칙 (UX_DECISIONS C8):
 *  - slug 빈값이고 titleEn 이 있으면 → 서버에서 slugify(titleEn)
 *  - slug 빈값이고 titleEn 도 빈값이면 → superRefine 으로 fieldErrors.slug ("직접 입력 필요")
 */
export const liveHeaderCreateSchema = baseLiveFields.superRefine((value, ctx) => {
  // slug 형식 검증 (값이 있는 경우만)
  if (value.slug && !SLUG_REGEX.test(value.slug)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["slug"],
      message: "slug 는 소문자/숫자/하이픈만 사용할 수 있습니다.",
    });
  }
  // slug 가 명시적 빈 문자열이고 titleEn 도 명시적 빈 문자열(또는 undefined)이면
  // 자동 생성 베이스가 없으므로 직접 입력을 요구한다.
  // 두 필드 모두 undefined 인 "최소 입력" 케이스는 schema 통과 — 액션 레이어에서
  // 추가로 처리한다 (UX_DECISIONS C8).
  if (value.slug === "" && (value.titleEn === "" || value.titleEn === undefined)) {
    if (value.titleEn === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "slug 를 직접 입력하거나 titleEn 을 채워주세요.",
      });
    }
  }
  refineTimeRelations(value, ctx);
});

export type LiveHeaderCreateInput = z.infer<typeof liveHeaderCreateSchema>;

/**
 * 편집(자동저장) 용 스키마.
 *
 * 모든 필드 optional. 단, 입력된 값은 동일 규칙으로 검증.
 *
 * 추가 규칙:
 *  - 필수 필드(titleKo / titleJp / venueName)를 빈 문자열로 덮어쓰는 시도 차단.
 *  - slug 형식 위반 거부.
 */
export const liveHeaderUpdateSchema = baseLiveFields.partial().superRefine(
  (value, ctx) => {
    if (value.titleKo !== undefined && value.titleKo.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["titleKo"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
    }
    if (value.titleJp !== undefined && value.titleJp.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["titleJp"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
    }
    if (value.venueName !== undefined && value.venueName.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venueName"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
    }
    if (value.slug !== undefined && value.slug.length > 0 && !SLUG_REGEX.test(value.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "slug 는 소문자/숫자/하이픈만 사용할 수 있습니다.",
      });
    }
    refineTimeRelations(value, ctx);
  }
);

export type LiveHeaderUpdateInput = z.infer<typeof liveHeaderUpdateSchema>;
