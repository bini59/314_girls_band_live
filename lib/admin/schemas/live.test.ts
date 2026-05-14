/**
 * Live 헤더 Zod 스키마 단위 테스트 (RED — 구현 전).
 *
 * 검증 대상:
 *  - JST_DATETIME_LOCAL_REGEX : `YYYY-MM-DDTHH:mm` 형식 + 의미상 유효 (refine)
 *  - liveHeaderCreateSchema   : 신규 생성 (필수 필드 + slug 규칙)
 *  - liveHeaderUpdateSchema   : 편집(자동저장, partial)
 *  - 시간 관계 검증            : doorsOpenAt < startAt, endAt > startAt
 *  - slug 자동 생성 보조       : slug 빈값 + titleEn 도 빈값 → "직접 입력 필요"
 *
 * 본 사이클 한정 가정 (TODO.md):
 *  - liveHeaderUpdateSchema 는 모든 필드 optional (부분 patch).
 *  - 입력된 필드는 동일 규칙으로 검증.
 */

import { describe, it, expect } from "vitest";

import {
  JST_DATETIME_LOCAL_REGEX,
  liveHeaderCreateSchema,
  liveHeaderUpdateSchema,
} from "./live";

const VALID_BASE = {
  titleKo: "MyGO!!!!! 1주년 라이브",
  titleJp: "MyGO!!!!! 1st ライブ「春の唄」",
  type: "SOLO" as const,
  startAtJst: "2026-03-15T18:00",
  venueName: "さいたまスーパーアリーナ",
};

describe("JST_DATETIME_LOCAL_REGEX", () => {
  it("'2026-03-15T18:00' 형식을 매칭", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15T18:00")).toBe(true);
  });

  it("'2026-03-15 18:00' (공백 구분자) 거절", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15 18:00")).toBe(false);
  });

  it("초 또는 ms 가 포함되면 거절", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15T18:00:00")).toBe(false);
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15T18:00:00.000")).toBe(false);
  });

  it("시간 누락(`2026-03-15T18`)은 거절", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15T18")).toBe(false);
  });

  it("날짜만(`2026-03-15`)은 거절", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("2026-03-15")).toBe(false);
  });

  it("빈 문자열은 거절", () => {
    expect(JST_DATETIME_LOCAL_REGEX.test("")).toBe(false);
  });
});

describe("liveHeaderCreateSchema — 성공 케이스", () => {
  it("필수 필드만 채운 최소 입력이 통과", () => {
    const parsed = liveHeaderCreateSchema.safeParse(VALID_BASE);
    expect(parsed.success).toBe(true);
  });

  it("선택 필드(titleEn/slug/venueAddress/notes 등)도 함께 허용", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      titleEn: "MyGO!!!!! 1st Live",
      slug: "mygo-1st-haru-no-uta",
      doorsOpenAtJst: "2026-03-15T17:00",
      endAtJst: "2026-03-15T21:00",
      venueAddress: "埼玉県さいたま市中央区新都心8",
      venueUrl: "https://www.saitama-arena.co.jp/",
      notes: "1주년 기념 공연",
    });
    expect(parsed.success).toBe(true);
  });

  it("titleEn 이 빈 문자열이어도 허용 (선택 필드)", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      titleEn: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("liveHeaderCreateSchema — 필수 필드 누락", () => {
  it.each([
    ["titleKo"],
    ["titleJp"],
    ["type"],
    ["startAtJst"],
    ["venueName"],
  ])("필수 필드 '%s' 누락 시 실패", (field) => {
    const input = { ...VALID_BASE } as Record<string, unknown>;
    delete input[field];
    const parsed = liveHeaderCreateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it.each([
    ["titleKo", ""],
    ["titleJp", ""],
    ["venueName", ""],
  ])("필수 필드 '%s' 가 빈 문자열이어도 실패", (field, value) => {
    const input = { ...VALID_BASE, [field]: value };
    const parsed = liveHeaderCreateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});

describe("liveHeaderCreateSchema — type enum 검증", () => {
  it("SOLO / TAIBAN / FES 만 허용", () => {
    for (const t of ["SOLO", "TAIBAN", "FES"]) {
      expect(
        liveHeaderCreateSchema.safeParse({ ...VALID_BASE, type: t }).success
      ).toBe(true);
    }
  });

  it("외부 값은 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      type: "FESTIVAL",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("liveHeaderCreateSchema — startAtJst 형식 검증", () => {
  it("`2026-03-15 18:00` (공백) 은 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      startAtJst: "2026-03-15 18:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("`2026-13-99T99:99` (regex 통과 모양이지만 의미상 무효) 도 실패 — refine 으로 거부", () => {
    // 본 입력은 regex 자체에서 거부되어도 OK, 의미 검증을 통과하지 못해도 OK.
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      startAtJst: "2026-13-99T25:99",
    });
    expect(parsed.success).toBe(false);
  });

  it("`2026-02-30T18:00` 같이 존재하지 않는 날짜는 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      startAtJst: "2026-02-30T18:00",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("liveHeaderCreateSchema — slug 검증", () => {
  it("유효 kebab-case 통과", () => {
    expect(
      liveHeaderCreateSchema.safeParse({
        ...VALID_BASE,
        slug: "mygo-1st-haru-no-uta",
      }).success
    ).toBe(true);
  });

  it("대문자 포함 slug 는 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      slug: "MyGO-1st",
    });
    expect(parsed.success).toBe(false);
  });

  it("언더스코어/공백 포함 slug 는 실패", () => {
    expect(
      liveHeaderCreateSchema.safeParse({
        ...VALID_BASE,
        slug: "mygo_1st",
      }).success
    ).toBe(false);
    expect(
      liveHeaderCreateSchema.safeParse({
        ...VALID_BASE,
        slug: "mygo 1st",
      }).success
    ).toBe(false);
  });

  it("빈 slug + titleEn 도 비어있으면 superRefine 으로 fieldErrors.slug 발생", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      slug: "",
      titleEn: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.slug).toBeDefined();
      expect((flat.slug as string[]).join(" ")).toMatch(/직접 입력|titleEn/);
    }
  });

  it("빈 slug 라도 titleEn 이 있으면 통과 (서버에서 자동 생성)", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      slug: "",
      titleEn: "MyGO 1st",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("liveHeaderCreateSchema — 시간 관계 검증", () => {
  it("doorsOpenAt 이 startAt 이후이면 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      doorsOpenAtJst: "2026-03-15T19:00",
      startAtJst: "2026-03-15T18:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("endAt 이 startAt 이전이면 실패", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      startAtJst: "2026-03-15T18:00",
      endAtJst: "2026-03-15T17:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("doorsOpenAt = startAt - 1시간, endAt = startAt + 3시간 통과", () => {
    const parsed = liveHeaderCreateSchema.safeParse({
      ...VALID_BASE,
      doorsOpenAtJst: "2026-03-15T17:00",
      endAtJst: "2026-03-15T21:00",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("liveHeaderUpdateSchema — 모든 필드 optional", () => {
  it("빈 객체 통과 (자동저장 디바운스 직후 변경 없음 케이스)", () => {
    const parsed = liveHeaderUpdateSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("titleKo 만 변경", () => {
    const parsed = liveHeaderUpdateSchema.safeParse({
      titleKo: "수정된 제목",
    });
    expect(parsed.success).toBe(true);
  });

  it("입력된 startAtJst 는 동일 형식 검증", () => {
    const parsed = liveHeaderUpdateSchema.safeParse({
      startAtJst: "2026-03-15 18:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("입력된 slug 는 동일 형식 검증 (대문자 거부)", () => {
    expect(
      liveHeaderUpdateSchema.safeParse({ slug: "MyGO" }).success
    ).toBe(false);
  });

  it("타입을 보내면 enum 검증", () => {
    expect(
      liveHeaderUpdateSchema.safeParse({ type: "INVALID" }).success
    ).toBe(false);
    expect(
      liveHeaderUpdateSchema.safeParse({ type: "TAIBAN" }).success
    ).toBe(true);
  });

  it("빈 titleKo (의미상 삭제 시도) 거부", () => {
    // 편집 자동저장에서 빈 문자열을 보낼 가능성은 사용자 실수.
    // 필수 필드를 빈 문자열로 덮어쓰지 못하도록 한다.
    const parsed = liveHeaderUpdateSchema.safeParse({ titleKo: "" });
    expect(parsed.success).toBe(false);
  });
});
