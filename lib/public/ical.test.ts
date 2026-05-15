import { describe, expect, it } from "vitest";

import { buildIcs } from "./ical";

const baseLive = {
  id: 1,
  slug: "mygo-fes-2026",
  titleKo: "MyGO!!!!! 단독공연",
  titleJp: "MyGO!!!!! ワンマン",
  type: "SOLO" as const,
  startAt: "2026-03-15T10:00:00.000Z",
  doorsOpenAt: null,
  endAt: "2026-03-15T13:00:00.000Z",
  venueName: "東京ガーデンシアター",
  thumbnailUrl: null,
  posterUrl: null,
  liveBands: [
    {
      isHeadliner: true,
      band: { id: 1, slug: "mygo", nameKo: "MyGO!!!!!", nameJp: "MyGO!!!!!" },
    },
  ],
};

describe("buildIcs", () => {
  it("VCALENDAR 헤더와 VEVENT 엔트리를 포함한다", () => {
    const ics = buildIcs({
      lives: [baseLive],
      host: "example.com",
      calendarName: "테스트 캘린더",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:live-mygo-fes-2026@example.com");
    expect(ics).toContain("DTSTART:20260315T100000Z");
    expect(ics).toContain("DTEND:20260315T130000Z");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Tokyo");
  });

  it("CRLF 줄바꿈을 사용한다", () => {
    const ics = buildIcs({
      lives: [baseLive],
      host: "example.com",
      calendarName: "테스트",
    });
    expect(ics).toMatch(/\r\n/);
  });

  it("쉼표/세미콜론/줄바꿈은 이스케이프된다", () => {
    const ics = buildIcs({
      lives: [
        {
          ...baseLive,
          titleKo: "Title, with; chars\nnewline",
        },
      ],
      host: "example.com",
      calendarName: "테스트",
    });
    expect(ics).toContain("Title\\, with\\; chars\\nnewline");
  });

  it("endAt 미지정 시 +3h fallback", () => {
    const ics = buildIcs({
      lives: [{ ...baseLive, endAt: null }],
      host: "example.com",
      calendarName: "테스트",
    });
    expect(ics).toContain("DTSTART:20260315T100000Z");
    expect(ics).toContain("DTEND:20260315T130000Z");
  });

  it("scope 가 주어지면 X-WR-CALDESC 로 포함된다 (투어 등)", () => {
    const ics = buildIcs({
      lives: [baseLive],
      host: "example.com",
      calendarName: "걸즈밴드 라이브 — gakumas-tour-shirube",
      scope: "투어: gakumas-tour-shirube",
    });
    expect(ics).toContain("X-WR-CALDESC:투어: gakumas-tour-shirube");
  });
});
