/**
 * Band 생성/편집 입력 검증 (Zod).
 *
 *  - slug: kebab-case ASCII, 1..100자.
 *  - workId: 양의 정수 필수 (Restrict 외래키).
 *  - nameKo / nameJp: 1..100자 필수.
 *  - nameEn: optional 100자.
 *  - officialUrl / imageUrl: http(s) URL, 500자. 빈 문자열 허용.
 *  - description: 2000자.
 *  - snsLinks: Record<string, URL> — 비어있지 않은 키, http(s) 값. 최대 10쌍. null 허용.
 *
 * 모든 사용자향 메시지 한국어.
 */
import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

const positiveIntId = z
  .number()
  .int("정수여야 합니다.")
  .positive("양의 정수만 허용됩니다.");

const httpUrl = z
  .string()
  .url("올바른 URL 이 아닙니다.")
  .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
  .max(500, "500자 이하로 입력해주세요.");

const snsLinksSchema = z
  .record(
    z
      .string()
      .min(1, "SNS 키는 비어있을 수 없습니다.")
      .max(30, "SNS 키는 30자 이하여야 합니다."),
    httpUrl
  )
  .refine((obj) => Object.keys(obj).length <= 10, {
    message: "SNS 링크는 최대 10개까지 등록할 수 있습니다.",
  });

const baseBandFields = z.object({
  workId: positiveIntId,
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
  officialUrl: httpUrl.optional().or(z.literal("")),
  imageUrl: httpUrl.optional().or(z.literal("")),
  description: z
    .string()
    .max(2000, "2000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  snsLinks: snsLinksSchema.nullable().optional(),
});

export const bandCreateSchema = baseBandFields;
export type BandCreateInput = z.infer<typeof bandCreateSchema>;

export const bandUpdateSchema = baseBandFields
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

export type BandUpdateInput = z.infer<typeof bandUpdateSchema>;
