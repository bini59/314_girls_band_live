/**
 * TicketSale (판매/추첨 라운드) 생성/편집 입력 검증 (Zod).
 *
 * - TicketSale 은 1건의 Live 에 대한 판매 라운드(FC선행/공식선행/플레이가이드선행/일반/당일/LV선행 등) 를 표현한다.
 * - 본 스키마는 JST datetime-local 4종 (starts/ends/announce/paymentDeadline) 의
 *   형식과 의미상 유효성, 시간 관계를 검증한다.
 * - 시간 관계 룰 (모두 "양쪽 모두 입력된 경우에 한해" 검증):
 *     starts < ends
 *     ends   <= announce
 *     announce <= paymentDeadline
 *   위배 시 더 뒤에 와야 할 필드 path 에 에러 추가.
 * - tierIds 는 N:M 관계(TicketSaleTier)용. create 시 빈 배열도 허용 (해당 라운드가 아직 어떤 티어에도 묶이지 않은 상태).
 *   update 스키마는 tierIds 를 다루지 않는다 — `setTicketSaleTiersAction` 가 별도로 책임.
 *
 * 모든 에러 메시지는 한국어.
 */
import { z } from "zod";

import { jstDateTimeLocalString, jstToEpoch } from "./_jst";

/** TicketSaleType — Prisma schema 와 동일. */
export const ticketSaleTypeSchema = z.enum([
  "FC_SENKO",
  "OFFICIAL_SENKO",
  "PLAYGUIDE_SENKO",
  "IPPAN",
  "TOJITSU",
  "LIVEVIEWING_SENKO",
  "LIVEVIEWING_IPPAN",
  "STREAMING_SALE",
  "OTHER",
]);
export type TicketSaleTypeInput = z.infer<typeof ticketSaleTypeSchema>;

/** TicketSaleMethod — Prisma schema 와 동일. */
export const ticketSaleMethodSchema = z.enum(["LOTTERY", "FIRST_COME"]);
export type TicketSaleMethodInput = z.infer<typeof ticketSaleMethodSchema>;

/**
 * 4종 JST datetime 의 시간 관계 검증.
 *
 * 양쪽 모두 입력된(빈 문자열이 아닌) 경우에만 비교. 한쪽이 비어있으면 통과.
 */
function refineTicketSaleTimes(
  value: {
    startsAtJst?: string;
    endsAtJst?: string;
    announceAtJst?: string;
    paymentDeadlineAtJst?: string;
  },
  ctx: z.RefinementCtx
): void {
  const starts = jstToEpoch(value.startsAtJst);
  const ends = jstToEpoch(value.endsAtJst);
  const announce = jstToEpoch(value.announceAtJst);
  const payment = jstToEpoch(value.paymentDeadlineAtJst);

  if (starts !== null && ends !== null && ends <= starts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAtJst"],
      message: "마감 시간은 시작 시간보다 늦어야 합니다.",
    });
  }
  if (ends !== null && announce !== null && announce < ends) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["announceAtJst"],
      message: "발표 시간은 마감 시간 이후여야 합니다.",
    });
  }
  if (announce !== null && payment !== null && payment < announce) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDeadlineAtJst"],
      message: "입금 기한은 발표 시간 이후여야 합니다.",
    });
  }
}

/**
 * 공통 본문 필드. create / update 가 공유.
 *
 * tierIds 는 본문에 별도 추가 (update 는 제외).
 */
const baseTicketSaleFields = z.object({
  vendorId: z
    .number({ invalid_type_error: "판매처를 선택해주세요." })
    .int("정수여야 합니다.")
    .positive("올바른 판매처 ID 가 아닙니다."),
  type: ticketSaleTypeSchema,
  method: ticketSaleMethodSchema,
  label: z
    .string()
    .max(200, "200자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  startsAtJst: jstDateTimeLocalString,
  endsAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  announceAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  paymentDeadlineAtJst: jstDateTimeLocalString.optional().or(z.literal("")),
  url: z
    .string()
    .url("올바른 URL 이 아닙니다.")
    .max(500, "500자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "2000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

/**
 * 생성용 스키마.
 *
 * 필수: vendorId, type, method, startsAtJst
 * tierIds 는 빈 배열 허용 (라운드 작성 시 티어 매핑은 나중에 할 수 있다).
 */
export const ticketSaleCreateSchema = baseTicketSaleFields
  .extend({
    tierIds: z
      .array(
        z
          .number()
          .int("정수여야 합니다.")
          .positive("올바른 티어 ID 가 아닙니다.")
      )
      .default([]),
  })
  .superRefine((value, ctx) => {
    refineTicketSaleTimes(value, ctx);
  });

export type TicketSaleCreateInput = z.infer<typeof ticketSaleCreateSchema>;

/**
 * 편집(부분 patch)용 스키마.
 *
 * - 모든 필드 optional. tierIds 는 본 스키마에 없음 (별도 setTicketSaleTiersAction 사용).
 * - 입력된 datetime 은 동일 규칙으로 검증.
 * - 시간 관계는 들어온 값들끼리만 검증.
 */
export const ticketSaleUpdateSchema = baseTicketSaleFields
  .partial()
  .superRefine((value, ctx) => {
    refineTicketSaleTimes(value, ctx);
  });

export type TicketSaleUpdateInput = z.infer<typeof ticketSaleUpdateSchema>;

/**
 * TicketSale ↔ TicketTier N:M 매핑 일괄 설정.
 *
 * 빈 배열 허용 — 모든 매핑을 제거하는 의미.
 */
export const setTicketSaleTiersSchema = z.array(
  z
    .number()
    .int("정수여야 합니다.")
    .positive("올바른 티어 ID 가 아닙니다.")
);

export type SetTicketSaleTiersInput = z.infer<typeof setTicketSaleTiersSchema>;
