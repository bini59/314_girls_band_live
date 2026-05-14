/**
 * JST 표시 유틸 (모든 시각은 UTC 저장 → JST 표시 컨벤션).
 *
 * 호스트 timezone 영향을 배제하기 위해 UTC + 9h shift 후 ISO를 파싱한다.
 */

const SHIFT_MS = 9 * 60 * 60 * 1000;

function shifted(date: Date): Date {
  return new Date(date.getTime() + SHIFT_MS);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type JstParts = {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
  weekday: number; // 0(일) - 6(토)
};

export function jstParts(date: Date): JstParts {
  const s = shifted(date);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    weekday: s.getUTCDay(),
  };
}

export function formatJstDate(date: Date): string {
  const p = jstParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function formatJstTime(date: Date): string {
  const p = jstParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatJstDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const p = jstParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatJstHuman(date: Date): string {
  const p = jstParts(date);
  return `${p.year}.${pad(p.month)}.${pad(p.day)} (${WEEKDAY_KO[p.weekday]}) ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * 어떤 Date가 JST 기준 어떤 날짜에 속하는지 "YYYY-MM-DD" 키로 반환.
 * 캘린더 그리드의 일자 묶음에 사용.
 */
export function jstDateKey(date: Date): string {
  return formatJstDate(date);
}

/**
 * JST 기준 month range [start, endExclusive) 의 UTC Date 쌍을 반환.
 * year, month(1-12) 입력.
 */
export function jstMonthRange(year: number, month: number): { start: Date; end: Date } {
  // JST 1일 00:00 = UTC 전날 15:00
  const startUtcMs = Date.UTC(year, month - 1, 1, 0, 0, 0) - SHIFT_MS;
  const endUtcMs = Date.UTC(year, month, 1, 0, 0, 0) - SHIFT_MS;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

/** JST 기준 [from(포함), to(미포함)) 임의 범위 — 주간 뷰 등 */
export function jstDateRange(from: { year: number; month: number; day: number }, days: number): { start: Date; end: Date } {
  const startUtcMs = Date.UTC(from.year, from.month - 1, from.day, 0, 0, 0) - SHIFT_MS;
  const endUtcMs = startUtcMs + days * 24 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
}

/** JST 기준 '지금'의 yyyy/mm/dd */
export function jstToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const p = jstParts(now);
  return { year: p.year, month: p.month, day: p.day };
}

export const WEEKDAY_LABELS = WEEKDAY_KO;
