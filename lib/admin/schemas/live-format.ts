/**
 * LiveFormat 생성/편집 입력 검증 (Zod).
 *
 * - LiveFormat 은 1건의 Live 에 대해 "현지 / LV / 배포" 같은 포맷을 표현한다.
 *   Prisma enum `LiveFormatType` = `LIVE_VENUE | LIVE_VIEWING | STREAMING`.
 * - 컨벤션: Live 1건당 LIVE_VENUE 포맷 1개 이상이 있어야 한다 (스키마 단에서 강제하지 않음 — 서비스 레이어 책임).
 * - 본 스키마는 다음을 검증한다:
 *   - type: enum
 *   - label/venueName: 최대 길이 200, 빈 문자열 허용(폼에서 미입력)
 *   - url: 올바른 URL 형식, 최대 길이 500, 빈 문자열 허용
 * - STREAMING 의 venueName 은 비워두는 게 일반적이나, 본 스키마는 그것을 강제하지 않는다(권고).
 *
 * 에러 메시지는 한국어. UX_DECISIONS 와 어드민 폼 톤을 따른다.
 */
import { z } from "zod";

/** LiveFormatType enum — Prisma schema 와 동일. */
export const liveFormatTypeSchema = z.enum([
  "LIVE_VENUE",
  "LIVE_VIEWING",
  "STREAMING",
]);
export type LiveFormatTypeInput = z.infer<typeof liveFormatTypeSchema>;

/**
 * 생성용 스키마.
 *
 * 필수: type
 * 선택: label / venueName / url (모두 빈 문자열 허용)
 */
export const liveFormatCreateSchema = z.object({
  type: liveFormatTypeSchema,
  label: z
    .string()
    .max(200, "200자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  venueName: z
    .string()
    .max(200, "200자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  url: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

export type LiveFormatCreateInput = z.infer<typeof liveFormatCreateSchema>;

/**
 * 편집(부분 patch)용 스키마. 모든 필드 optional.
 *
 * - type 을 보낼 경우 enum 검증 그대로 적용.
 * - 다른 필드는 형식만 검증.
 */
export const liveFormatUpdateSchema = liveFormatCreateSchema.partial();

export type LiveFormatUpdateInput = z.infer<typeof liveFormatUpdateSchema>;
