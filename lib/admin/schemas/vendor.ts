/**
 * Vendor (판매처: e+, 로손, FC, 공식 등) 생성/편집 입력 검증 (Zod).
 *
 * - slug: kebab-case ASCII (^[a-z0-9-]+$), 1..100자. URL 안전.
 * - name: 1..100자. 표시용.
 * - baseUrl / logoUrl: 올바른 URL, 최대 500자. 빈 문자열 허용.
 * - notes: 최대 1000자, 빈 문자열 허용.
 * - vendorUpdateSchema 는 partial 이지만, 필수 필드(slug/name)를 빈 문자열로 덮어쓰는 시도를 거부한다
 *   (`liveHeaderUpdateSchema` 동일 패턴).
 *
 * 모든 에러 메시지는 한국어.
 */
import { z } from "zod";

/** Slug 형식: kebab-case ASCII (대문자/언더스코어/공백 불허). */
const SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * 공통 본문 필드. create / update 가 공유.
 */
const baseVendorFields = z.object({
  slug: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요.")
    .regex(SLUG_REGEX, "slug 는 소문자/숫자/하이픈만 사용할 수 있습니다."),
  name: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요."),
  baseUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "1000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

/**
 * 생성용 스키마.
 *
 * 필수: slug, name
 * 선택: baseUrl, logoUrl, notes
 */
export const vendorCreateSchema = baseVendorFields;

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;

/**
 * 편집(부분 patch)용 스키마.
 *
 * - 모든 필드 optional.
 * - 필수 필드(slug / name)를 빈 문자열로 덮어쓰는 시도 차단.
 * - slug 형식 위반 거부 (값이 있을 때만).
 */
export const vendorUpdateSchema = baseVendorFields
  .partial()
  .superRefine((value, ctx) => {
    if (value.slug !== undefined && value.slug.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
    }
    if (value.name !== undefined && value.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
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
  });

export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
