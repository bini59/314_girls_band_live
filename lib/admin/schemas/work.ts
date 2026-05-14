/**
 * Work (작품) 생성/편집 입력 검증 (Zod).
 *
 *  - slug: kebab-case ASCII, 1..100자.
 *  - nameKo / nameJp: 1..100자 필수.
 *  - nameEn / kind / logoUrl / description: 옵셔널. 빈 문자열 = 값 제거 의도.
 *  - seriesId: 양의 정수 또는 null (시리즈 미연결). 0/음수/소수/문자열 거부.
 *  - kind 는 자유 텍스트 ("anime", "game", "media_mix" 등) — 50자 제한.
 */
import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9-]+$/;

const seriesIdSchema = z
  .number()
  .int("정수여야 합니다.")
  .positive("양의 정수만 허용됩니다.")
  .nullable();

const baseWorkFields = z.object({
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
  kind: z
    .string()
    .max(50, "50자 이하로 입력해주세요.")
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
  seriesId: seriesIdSchema.optional(),
});

export const workCreateSchema = baseWorkFields;
export type WorkCreateInput = z.infer<typeof workCreateSchema>;

export const workUpdateSchema = baseWorkFields
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

export type WorkUpdateInput = z.infer<typeof workUpdateSchema>;
