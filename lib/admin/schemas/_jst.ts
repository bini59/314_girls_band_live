/**
 * JST datetime-local 공용 Zod 스키마 / 정규식.
 *
 * - 어드민 폼은 `<input type="datetime-local">` 으로 JST `YYYY-MM-DDTHH:mm` 형식을 전송한다.
 * - regex 만으로는 `2026-13-99T25:99` 같은 의미상 무효 입력을 거를 수 없어
 *   superRefine 으로 `new Date()` 의 NaN 여부 + 보정 echo 검사를 한다.
 * - 본 헬퍼는 `live.ts` 의 동일 로직을 다른 도메인 스키마(TicketSale 등)와 공유하기 위한 추출본이다.
 *
 * 본 파일은 `live.ts` 에 정의된 동일 로직과 동치를 보장한다 (수정 시 함께 변경).
 */
import { z } from "zod";

/**
 * JST datetime-local 형식 (`YYYY-MM-DDTHH:mm`) 정규식.
 *
 * - 4자리 연도 + `-` + 2자리 월 + `-` + 2자리 일 + `T` + 2자리 시 + `:` + 2자리 분
 * - 초/ms 불허, 공백 구분자 불허
 */
export const JST_DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * JST datetime-local 문자열 zod 스키마.
 *
 * 1) regex 검증
 * 2) 의미상 유효성: `new Date(${value}:00+09:00)` 가 NaN 이 아닌지
 * 3) Date 자동 보정 차단: `2026-02-30T18:00` 같이 존재하지 않는 날짜 거부.
 *
 * 빈 문자열은 허용하지 않는다 — 호출자가 optional 처리.
 */
export const jstDateTimeLocalString = z
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

/**
 * JST datetime-local 문자열을 UTC epoch(ms)로 변환. NaN 이면 null.
 *
 * superRefine 의 시간 관계 비교에서 사용한다.
 */
export function jstToEpoch(val: string | undefined | null): number | null {
  if (!val) return null;
  const t = new Date(`${val}:00+09:00`).getTime();
  return Number.isNaN(t) ? null : t;
}
