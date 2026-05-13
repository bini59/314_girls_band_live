import { describe, it, expect } from "vitest";
import {
  fillDefaultTime,
  jstLocalToUtc,
  utcToJstLocal,
  roundToFiveMinutes,
  type TimeFieldKind,
} from "./jst-datetime";

describe("fillDefaultTime - 시간이 없는 입력에 기본 시간 채움 (JST)", () => {
  it("startAt 은 기본 18:00", () => {
    expect(fillDefaultTime("2026-08-15", "startAt")).toBe("2026-08-15T18:00");
  });

  it("doorsOpenAt 은 기본 18:00", () => {
    expect(fillDefaultTime("2026-08-15", "doorsOpenAt")).toBe(
      "2026-08-15T18:00"
    );
  });

  it("endAt 은 기본 21:00", () => {
    expect(fillDefaultTime("2026-08-15", "endAt")).toBe("2026-08-15T21:00");
  });

  it("saleStart 는 기본 10:00", () => {
    expect(fillDefaultTime("2026-08-15", "saleStart")).toBe("2026-08-15T10:00");
  });

  it("announceAt 은 기본 10:00", () => {
    expect(fillDefaultTime("2026-08-15", "announceAt")).toBe(
      "2026-08-15T10:00"
    );
  });

  it("saleEnd 는 기본 23:59", () => {
    expect(fillDefaultTime("2026-08-15", "saleEnd")).toBe("2026-08-15T23:59");
  });

  it("paymentDeadline 은 기본 23:59", () => {
    expect(fillDefaultTime("2026-08-15", "paymentDeadline")).toBe(
      "2026-08-15T23:59"
    );
  });
});

describe("fillDefaultTime - 이미 시간이 포함된 값은 그대로 반환", () => {
  it("이미 시간이 있는 startAt 값은 보존된다", () => {
    expect(fillDefaultTime("2026-08-15T20:30", "startAt")).toBe(
      "2026-08-15T20:30"
    );
  });

  it("이미 시간이 있는 saleEnd 값은 보존된다", () => {
    expect(fillDefaultTime("2026-08-15T12:34", "saleEnd")).toBe(
      "2026-08-15T12:34"
    );
  });
});

describe("fillDefaultTime - 빈 값", () => {
  it("빈 문자열은 그대로 빈 문자열 반환", () => {
    const fields: TimeFieldKind[] = [
      "startAt",
      "doorsOpenAt",
      "endAt",
      "saleStart",
      "saleEnd",
      "announceAt",
      "paymentDeadline",
    ];
    for (const f of fields) {
      expect(fillDefaultTime("", f)).toBe("");
    }
  });
});

describe("jstLocalToUtc - JST datetime-local → UTC Date 변환", () => {
  it("JST 18:00 은 UTC 09:00", () => {
    const utc = jstLocalToUtc("2026-08-15T18:00");
    expect(utc.toISOString()).toBe("2026-08-15T09:00:00.000Z");
  });

  it("JST 00:00 은 전날 UTC 15:00 (날짜 경계 처리)", () => {
    const utc = jstLocalToUtc("2026-01-01T00:00");
    expect(utc.toISOString()).toBe("2025-12-31T15:00:00.000Z");
  });

  it("JST 09:00 은 UTC 00:00", () => {
    const utc = jstLocalToUtc("2026-08-15T09:00");
    expect(utc.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });
});

describe("utcToJstLocal - UTC Date → JST datetime-local 문자열", () => {
  it("UTC 09:00 은 JST 18:00", () => {
    expect(utcToJstLocal(new Date("2026-08-15T09:00:00Z"))).toBe(
      "2026-08-15T18:00"
    );
  });

  it("UTC 15:00 (전날) 은 JST 00:00 (다음날)", () => {
    expect(utcToJstLocal(new Date("2025-12-31T15:00:00Z"))).toBe(
      "2026-01-01T00:00"
    );
  });
});

describe("jstLocalToUtc ↔ utcToJstLocal 라운드트립", () => {
  it("JST 18:00 → UTC → JST 동일 값", () => {
    const original = "2026-08-15T18:00";
    expect(utcToJstLocal(jstLocalToUtc(original))).toBe(original);
  });

  it("자정 직전 5분 단위 값도 라운드트립", () => {
    const original = "2026-08-15T23:55";
    expect(utcToJstLocal(jstLocalToUtc(original))).toBe(original);
  });
});

describe("roundToFiveMinutes - 5분 단위 반올림", () => {
  it("18:03 은 18:05 로 올림", () => {
    expect(roundToFiveMinutes("2026-08-15T18:03")).toBe("2026-08-15T18:05");
  });

  it("18:02 는 18:00 으로 내림 (절반 미만)", () => {
    expect(roundToFiveMinutes("2026-08-15T18:02")).toBe("2026-08-15T18:00");
  });

  it("18:07 은 18:05 로 내림 (절반 미만)", () => {
    expect(roundToFiveMinutes("2026-08-15T18:07")).toBe("2026-08-15T18:05");
  });

  it("18:00 (이미 5분 단위) 은 그대로", () => {
    expect(roundToFiveMinutes("2026-08-15T18:00")).toBe("2026-08-15T18:00");
  });

  it("18:58 은 19:00 으로 (시각 경계 올림)", () => {
    expect(roundToFiveMinutes("2026-08-15T18:58")).toBe("2026-08-15T19:00");
  });

  it("23:58 은 다음날 00:00 으로 (날짜 경계 올림)", () => {
    expect(roundToFiveMinutes("2026-08-15T23:58")).toBe("2026-08-16T00:00");
  });
});

describe("jst-datetime - 호스트 timezone 비의존성", () => {
  it("TZ 환경변수가 'America/New_York' 이어도 jstLocalToUtc 결과 동일", () => {
    const originalTZ = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      // 함수 내부는 호스트 TZ 무시. 결과 ISO 는 동일.
      const utc = jstLocalToUtc("2026-08-15T18:00");
      expect(utc.toISOString()).toBe("2026-08-15T09:00:00.000Z");
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});
