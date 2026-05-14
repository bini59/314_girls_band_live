/**
 * Series (시리즈/IP) 생성/편집 입력 검증 (Zod).
 *
 *  - slug: kebab-case ASCII (^[a-z0-9-]+$), 1..100자.
 *  - nameKo / nameJp: 1..100자 필수.
 *  - nameEn: 0..100자 옵셔널, 빈 문자열은 값 제거 의도.
 *  - logoUrl: http(s) URL, 최대 500자. 빈 문자열 허용.
 *  - description: 최대 2000자, 빈 문자열 허용.
 *  - seriesUpdateSchema 는 partial 이지만, 필수 필드(slug/nameKo/nameJp)를
 *    빈 문자열로 덮어쓰는 시도를 거부한다 (vendor 패턴 미러).
 *
 * 모든 에러 메시지는 한국어.
 */
import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

const baseSeriesFields = z.object({
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
  logoUrl: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "2000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

export const seriesCreateSchema = baseSeriesFields;
export type SeriesCreateInput = z.infer<typeof seriesCreateSchema>;

export const seriesUpdateSchema = baseSeriesFields
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
  });

export type SeriesUpdateInput = z.infer<typeof seriesUpdateSchema>;
