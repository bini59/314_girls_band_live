/**
 * JST 표시 포맷터.
 *
 * UTC Date 를 "YYYY-MM-DD HH:mm" 형태의 JST 문자열로 변환한다.
 * 호스트 timezone 영향을 피하기 위해 UTC + 9h shift 방식을 사용.
 */

export function formatJstDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const iso = shifted.toISOString(); // "2026-03-15T09:00:00.000Z"
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}
