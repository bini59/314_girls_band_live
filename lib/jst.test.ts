import { describe, expect, it } from "vitest";

import {
  formatJstDate,
  formatJstDateTime,
  formatJstHuman,
  formatJstTime,
  jstDateKey,
  jstMonthRange,
  jstParts,
} from "./jst";

describe("jst", () => {
  // JST 2026-03-15 19:00 = UTC 2026-03-15 10:00
  const sample = new Date("2026-03-15T10:00:00Z");

  it("jstParts: UTC → JST 변환", () => {
    expect(jstParts(sample)).toMatchObject({
      year: 2026,
      month: 3,
      day: 15,
      hour: 19,
      minute: 0,
    });
  });

  it("formatJstDate / formatJstTime / formatJstDateTime", () => {
    expect(formatJstDate(sample)).toBe("2026-03-15");
    expect(formatJstTime(sample)).toBe("19:00");
    expect(formatJstDateTime(sample)).toBe("2026-03-15 19:00");
  });

  it("formatJstHuman: 요일 포함", () => {
    // 2026-03-15는 일요일.
    expect(formatJstHuman(sample)).toBe("2026.03.15 (일) 19:00");
  });

  it("jstDateKey", () => {
    expect(jstDateKey(sample)).toBe("2026-03-15");
  });

  it("formatJstDateTime: null/invalid", () => {
    expect(formatJstDateTime(null)).toBe("—");
    expect(formatJstDateTime(undefined)).toBe("—");
    expect(formatJstDateTime("not a date")).toBe("—");
  });

  it("jstMonthRange: JST 1일 0시는 UTC 전날 15시", () => {
    const { start, end } = jstMonthRange(2026, 3);
    expect(start.toISOString()).toBe("2026-02-28T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-31T15:00:00.000Z");
  });

  it("일자 경계: UTC 14:59 (JST 23:59) 와 UTC 15:00 (JST 다음날 0:00)", () => {
    expect(jstDateKey(new Date("2026-03-15T14:59:00Z"))).toBe("2026-03-15");
    expect(jstDateKey(new Date("2026-03-15T15:00:00Z"))).toBe("2026-03-16");
  });
});
