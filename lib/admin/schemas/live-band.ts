/**
 * LiveBand 등록/순서변경 입력 검증 (Zod).
 *
 * - LiveBand 는 Live ↔ Band 의 조인 테이블이며, 1건의 Live 에 페스/대반일 때 여러 Band 가 묶인다.
 * - `liveBandUpsertSchema`     : 특정 Live 에 Band 1건을 추가/업데이트할 때 사용.
 *   - bandId: 양의 정수 (Band.id)
 *   - isHeadliner: 헤드라이너 여부 (기본 false)
 *   - order: 표시 순서 (0 이상 정수, 기본 0)
 * - `liveBandReorderSchema`    : 한 Live 의 LiveBand 들을 일괄 정렬할 때 사용.
 *   - bandIds 배열 — 순서대로 늘어선 Band.id 목록 (1개 이상 필수).
 *
 * 모든 에러 메시지는 한국어. UX_DECISIONS 와 어드민 폼 톤을 따른다.
 */
import { z } from "zod";

/**
 * LiveBand 1건 추가/업데이트.
 *
 * 같은 (liveId, bandId) 가 이미 있으면 isHeadliner/order 만 갱신.
 */
export const liveBandUpsertSchema = z.object({
  bandId: z
    .number({ invalid_type_error: "밴드를 선택해주세요." })
    .int("정수여야 합니다.")
    .positive("올바른 밴드 ID 가 아닙니다."),
  isHeadliner: z.boolean().default(false),
  order: z
    .number()
    .int("정수여야 합니다.")
    .min(0, "순서는 0 이상이어야 합니다.")
    .default(0),
});

export type LiveBandUpsertInput = z.infer<typeof liveBandUpsertSchema>;

/**
 * 한 Live 의 LiveBand 순서 일괄 변경.
 *
 * 입력: 정렬된 Band.id 배열. 빈 배열은 거부(아무 것도 변경할 게 없으면 호출하지 말 것).
 */
export const liveBandReorderSchema = z
  .array(
    z
      .number()
      .int("정수여야 합니다.")
      .positive("올바른 밴드 ID 가 아닙니다.")
  )
  .min(1, "정렬 대상이 1개 이상 필요합니다.");

export type LiveBandReorderInput = z.infer<typeof liveBandReorderSchema>;
