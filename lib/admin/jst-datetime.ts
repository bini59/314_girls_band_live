/**
 * JST (Asia/Tokyo, UTC+9, DST 없음) datetime-local 입력 처리 유틸.
 *
 * 모든 함수는 **호스트 timezone 에 의존하지 않는다.**
 * - 입력/출력 문자열은 `YYYY-MM-DDTHH:mm` 형식 (datetime-local 표준).
 * - 내부적으로 `Date` 객체는 절대 시각(UTC) 만 표현하며,
 *   문자열 변환 시 명시적으로 `+09:00` offset 을 부여한다.
 */

/**
 * 시간 기본값을 채울 필드 종류.
 *
 * - `startAt`, `doorsOpenAt` → 18:00 (일본 라이브 통상)
 * - `endAt`                  → 21:00 (시작 +3시간 추정)
 * - `saleStart`, `announceAt` → 10:00 (일본 발매 통상)
 * - `saleEnd`, `paymentDeadline` → 23:59 (마감 시각)
 */
export type TimeFieldKind =
  | "startAt"
  | "doorsOpenAt"
  | "endAt"
  | "saleStart"
  | "announceAt"
  | "saleEnd"
  | "paymentDeadline";

const DEFAULT_TIME_BY_FIELD: Record<TimeFieldKind, string> = {
  startAt: "18:00",
  doorsOpenAt: "18:00",
  endAt: "21:00",
  saleStart: "10:00",
  announceAt: "10:00",
  saleEnd: "23:59",
  paymentDeadline: "23:59",
};

/**
 * 시간이 비어있는 datetime-local 입력에 필드별 기본 시간을 채운다.
 *
 * - 빈 문자열은 그대로 빈 문자열로 반환 (사용자가 의도적으로 비웠을 수 있음).
 * - 이미 시간(`T` 뒤) 이 포함되어 있으면 입력값 그대로 반환.
 * - 날짜만 있는 경우 (`YYYY-MM-DD`) 필드별 기본 시간을 부착.
 */
export function fillDefaultTime(value: string, field: TimeFieldKind): string {
  if (value === "") {
    return "";
  }
  if (value.includes("T")) {
    return value;
  }
  return `${value}T${DEFAULT_TIME_BY_FIELD[field]}`;
}

/**
 * JST datetime-local 문자열 (`YYYY-MM-DDTHH:mm`) 을 UTC `Date` 로 변환.
 *
 * 호스트 timezone 영향을 받지 않도록 명시적으로 `+09:00` offset 을 부착하여
 * `Date` 생성자에 넘긴다.
 */
export function jstLocalToUtc(localStr: string): Date {
  return new Date(`${localStr}:00+09:00`);
}

/**
 * UTC `Date` 를 JST datetime-local 문자열 (`YYYY-MM-DDTHH:mm`) 로 변환.
 *
 * 호스트 TZ 영향을 피하기 위해 UTC 시각에 9시간을 더한 뒤
 * `toISOString()` 의 상위 16글자(`YYYY-MM-DDTHH:mm`) 를 잘라 사용한다.
 */
export function utcToJstLocal(date: Date): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * datetime-local 문자열의 분(minute) 을 가장 가까운 5분 단위로 반올림.
 *
 * - half-up: `:02` → `:00`, `:03` → `:05`, `:07` → `:05` (round-half-up 의 5분 버전).
 * - 시각 / 날짜 경계를 정확히 처리 (예: `23:58` → 다음날 `00:00`).
 *
 * 내부에서 JST → UTC → +N분 → UTC → JST 변환을 거치며, 모든 산술은
 * `Date.getTime()` 기반이라 호스트 TZ 와 무관하다.
 */
export function roundToFiveMinutes(value: string): string {
  // JST 로컬 문자열을 UTC Date 로 변환 (절대 시각).
  const utc = jstLocalToUtc(value);

  // 5분 단위로 반올림한 후의 분 오프셋을 계산.
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const rounded = Math.round(utc.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS;

  return utcToJstLocal(new Date(rounded));
}
