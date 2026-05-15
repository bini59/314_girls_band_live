/**
 * Tour (투어) 생성/편집 입력 검증 (Zod).
 *
 *  - slug: kebab-case ASCII, 1..100자.
 *  - nameKo / nameJp: 1..100자 필수.
 *  - nameEn / description / posterUrl / thumbnailUrl / officialUrl: 옵셔널.
 *    빈 문자열 = 값 제거 의도.
 *  - workId: 양의 정수 필수 (Work 미연결 투어는 허용하지 않음).
 *  - startsAt / endsAt: JST datetime-local 옵셔널. 둘 다 있으면 endsAt >= startsAt.
 *  - status: enum (DRAFT / PUBLISHED).
 *
 *  Live 의 datetime-local 패턴(JST_DATETIME_LOCAL_REGEX) 을 그대로 따른다.
 */
import { z } from "zod";

import { JST_DATETIME_LOCAL_REGEX } from "./live";

const SLUG_REGEX = /^[a-z0-9-]+$/;

const workIdSchema = z
  .number()
  .int("정수여야 합니다.")
  .positive("양의 정수만 허용됩니다.");

export const tourStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export type TourStatusInput = z.infer<typeof tourStatusSchema>;

/**
 * 투어용 datetime-local 검증 — `YYYY-MM-DDTHH:mm` (JST 기준).
 *
 * Live 와 달리 분 단위까지만 받고, 의미상 유효성도 검사.
 * 빈 문자열은 허용 (호출자가 optional 처리).
 */
const jstDateTimeLocalString = z
  .string()
  .regex(JST_DATETIME_LOCAL_REGEX, {
    message: "JST datetime-local 형식이어야 합니다 (YYYY-MM-DDTHH:mm).",
  })
  .superRefine((val, ctx) => {
    const d = new Date(`${val}:00+09:00`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "유효한 날짜/시간이 아닙니다.",
      });
      return;
    }
    const shiftedToJst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const echo = shiftedToJst.toISOString().slice(0, 16);
    if (echo !== val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "유효한 날짜/시간이 아닙니다.",
      });
    }
  });

const baseTourFields = z.object({
  slug: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요.")
    .regex(SLUG_REGEX, "slug 는 소문자/숫자/하이픈만 사용할 수 있습니다."),
  nameKo: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요."),
  nameJp: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요."),
  nameEn: z
    .string()
    .max(100, "100자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  workId: workIdSchema,
  description: z
    .string()
    .max(2000, "2000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  posterUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  thumbnailUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  officialUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  startsAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  endsAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  status: tourStatusSchema.optional(),
});

function refineDateRange(
  value: { startsAtJst?: string; endsAtJst?: string },
  ctx: z.RefinementCtx
): void {
  if (!value.startsAtJst || !value.endsAtJst) return;
  const start = new Date(`${value.startsAtJst}:00+09:00`).getTime();
  const end = new Date(`${value.endsAtJst}:00+09:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return;
  if (end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAtJst"],
      message: "종료일은 시작일보다 늦어야 합니다.",
    });
  }
}

export const tourCreateSchema = baseTourFields.superRefine((value, ctx) => {
  refineDateRange(value, ctx);
});
export type TourCreateInput = z.infer<typeof tourCreateSchema>;

export const tourUpdateSchema = baseTourFields
  .partial()
  .superRefine((value, ctx) => {
    const requiredKeys = ["slug", "nameKo", "nameJp"] as const;
    for (const key of requiredKeys) {
      if (value[key] !== undefined && value[key]!.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
        });
      }
    }
    if (
      value.slug !== undefined &&
      value.slug.length > 0 &&
      !SLUG_REGEX.test(value.slug)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "slug 는 소문자/숫자/하이픈만 사용할 수 있습니다.",
      });
    }
    refineDateRange(value, ctx);
  });
export type TourUpdateInput = z.infer<typeof tourUpdateSchema>;
