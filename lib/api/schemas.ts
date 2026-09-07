/**
 * 공개 API 경계 Zod 스키마.
 *
 * 어드민 폼(JST datetime-local)과 달리 API 입출력 datetime 은 순수 UTC ISO 8601.
 * datetime 필드는 파싱 후 Date 로 변환하여 repo 입력 타입에 그대로 전달한다.
 * 출력은 Prisma Date 를 Response.json 이 UTC ISO 로 직렬화하므로 별도 변환 없음.
 *
 * URL/길이 규칙은 어드민 스키마(lib/admin/schemas/*)와 동일한 신뢰 경계를 갖는다.
 * `httpUrl` 은 http(s) 스킴만 허용 — `javascript:` 등 XSS 스킴을 차단한다.
 */
import { z } from "zod";

/** UTC ISO 8601 문자열 → Date. */
const utcDate = z.string().datetime().transform((s) => new Date(s));

/** http(s) URL 만 허용 (javascript:/data: 스킴 차단), 500자 이하. */
const httpUrl = z
  .string()
  .url()
  .regex(/^https?:\/\//i, "http(s) URL 만 허용됩니다.")
  .max(500);

/** SNS 링크: 비어있지 않은 키(≤30자) → http(s) URL, 최대 10쌍. */
const snsLinks = z
  .record(z.string().min(1).max(30), httpUrl)
  .refine((obj) => Object.keys(obj).length <= 10, {
    message: "SNS 링크는 최대 10개까지 등록할 수 있습니다.",
  });

export const createLiveSchema = z.object({
  slug: z.string().min(1).max(100),
  titleKo: z.string().min(1).max(200),
  titleJp: z.string().min(1).max(200),
  titleEn: z.string().max(200).nullish(),
  type: z.enum(["SOLO", "TAIBAN", "FES"]),
  startAt: utcDate,
  doorsOpenAt: utcDate.nullish(),
  endAt: utcDate.nullish(),
  venueName: z.string().min(1).max(200),
  venueAddress: z.string().max(500).nullish(),
  venueUrl: httpUrl.nullish(),
  posterUrl: httpUrl.nullish(),
  thumbnailUrl: httpUrl.nullish(),
  notes: z.string().max(10000).nullish(),
  tourId: z.number().int().nullish(),
});

export const updateLiveSchema = createLiveSchema.partial();

export const createBandSchema = z.object({
  workId: z.number().int(),
  slug: z.string().min(1).max(100),
  nameKo: z.string().min(1).max(100),
  nameJp: z.string().min(1).max(100),
  nameEn: z.string().max(100).nullish(),
  officialUrl: httpUrl.nullish(),
  imageUrl: httpUrl.nullish(),
  description: z.string().max(2000).nullish(),
  snsLinks: snsLinks.nullish(),
});
