/**
 * TicketTier 생성/편집/순서변경 입력 검증 (Zod).
 *
 * - TicketTier 는 LiveFormat 산하의 좌석/등급(예: "S석", "스탠딩", "VIP", "LV 일반석") 을 표현한다.
 * - priceJpy 는 일본 엔(JPY) 정수. 무료 좌석(0)도 허용.
 * - 본 스키마:
 *   - `ticketTierCreateSchema`  : 등급 1건 추가 (formatId 는 라우트 파라미터로 받는다고 가정 — 본 스키마는 본문만).
 *   - `ticketTierUpdateSchema`  : 부분 패치. name 을 명시적으로 빈 문자열로 보낼 경우 거부.
 *   - `ticketTierReorderSchema` : 한 LiveFormat 의 티어를 일괄 정렬(정렬된 tier.id 배열).
 *
 * 모든 에러 메시지는 한국어.
 */
import { z } from "zod";

/**
 * 생성용 스키마.
 *
 * 필수: name (1..100), priceJpy (0 이상 정수)
 * 선택: order (0 이상 정수, 기본 0), notes (최대 1000자, 빈 문자열 허용)
 */
export const ticketTierCreateSchema = z.object({
  name: z
    .string()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요."),
  priceJpy: z
    .number({ invalid_type_error: "정수여야 합니다." })
    .int("정수여야 합니다.")
    .min(0, "가격은 0 이상이어야 합니다."),
  order: z
    .number()
    .int("정수여야 합니다.")
    .min(0, "순서는 0 이상이어야 합니다.")
    .default(0),
  notes: z
    .string()
    .max(1000, "1000자 이하로 입력해주세요.")
    .optional()
    .or(z.literal("")),
});

export type TicketTierCreateInput = z.infer<typeof ticketTierCreateSchema>;

/**
 * 편집(부분 patch)용 스키마.
 *
 * - 모든 필드 optional.
 * - name 을 명시적으로 빈 문자열로 보낼 경우 거부 (필수 필드 삭제 시도 차단).
 * - priceJpy / order 가 음수면 거부.
 */
export const ticketTierUpdateSchema = ticketTierCreateSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.name !== undefined && value.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "필수 항목을 빈 값으로 저장할 수 없습니다.",
      });
    }
  });

export type TicketTierUpdateInput = z.infer<typeof ticketTierUpdateSchema>;

/**
 * 한 LiveFormat 내 TicketTier 순서 일괄 변경.
 *
 * 입력: 정렬된 TicketTier.id 배열. 빈 배열은 거부.
 */
export const ticketTierReorderSchema = z
  .array(
    z
      .number()
      .int("정수여야 합니다.")
      .positive("올바른 티어 ID 가 아닙니다.")
  )
  .min(1, "정렬 대상이 1개 이상 필요합니다.");

export type TicketTierReorderInput = z.infer<typeof ticketTierReorderSchema>;
