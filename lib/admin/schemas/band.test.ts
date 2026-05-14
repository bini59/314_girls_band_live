/**
 * Band Zod 스키마 단위 테스트.
 *
 *  - bandCreateSchema   : workId 정수(>0) 필수. slug, nameKo, nameJp 필수.
 *                        officialUrl/imageUrl http(s). snsLinks 는 Record<string, URL>.
 *  - bandUpdateSchema   : partial. 필수 빈 문자열 거부.
 */
import { describe, it, expect } from "vitest";

import { bandCreateSchema, bandUpdateSchema } from "./band";

const VALID_BAND = {
  workId: 1,
  slug: "mygo",
  nameKo: "마이고",
  nameJp: "MyGO!!!!!",
};

describe("bandCreateSchema — 성공", () => {
  it("필수 필드만 통과", () => {
    expect(bandCreateSchema.safeParse(VALID_BAND).success).toBe(true);
  });

  it("snsLinks 빈 객체 허용", () => {
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, snsLinks: {} }).success
    ).toBe(true);
  });

  it("snsLinks 임의 키 + URL 값 허용", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        snsLinks: {
          twitter: "https://twitter.com/mygo",
          youtube: "https://youtube.com/@mygo",
        },
      }).success
    ).toBe(true);
  });

  it("모든 필드 채운 풀 페이로드", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        nameEn: "MyGO!!!!!",
        officialUrl: "https://anime-bangdream.com/mygo/",
        imageUrl: "https://example.com/mygo.png",
        description: "밴드 설명",
        snsLinks: { twitter: "https://twitter.com/mygo" },
      }).success
    ).toBe(true);
  });

  it("옵셔널 URL 빈 문자열 허용", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        nameEn: "",
        officialUrl: "",
        imageUrl: "",
        description: "",
      }).success
    ).toBe(true);
  });
});

describe("bandCreateSchema — 필수 검증", () => {
  it.each([["workId"], ["slug"], ["nameKo"], ["nameJp"]])(
    "필수 '%s' 누락 실패",
    (field) => {
      const input = { ...VALID_BAND } as Record<string, unknown>;
      delete input[field];
      expect(bandCreateSchema.safeParse(input).success).toBe(false);
    }
  );

  it.each([["slug"], ["nameKo"], ["nameJp"]])(
    "필수 문자열 '%s' 빈 문자열 실패",
    (field) => {
      expect(
        bandCreateSchema.safeParse({ ...VALID_BAND, [field]: "" }).success
      ).toBe(false);
    }
  );

  it("workId 음수 / 0 / 소수 / 문자열 거부", () => {
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, workId: -1 }).success
    ).toBe(false);
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, workId: 0 }).success
    ).toBe(false);
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, workId: 1.5 }).success
    ).toBe(false);
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, workId: "1" }).success
    ).toBe(false);
  });
});

describe("bandCreateSchema — URL", () => {
  it("officialUrl 잘못된 URL 거부", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        officialUrl: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("officialUrl javascript: 거부", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        officialUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });
});

describe("bandCreateSchema — snsLinks", () => {
  it("값이 URL 이 아니면 거부", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        snsLinks: { twitter: "not-a-url" },
      }).success
    ).toBe(false);
  });

  it("값이 javascript: 이면 거부", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        snsLinks: { twitter: "javascript:alert(1)" },
      }).success
    ).toBe(false);
  });

  it("빈 문자열 키 거부", () => {
    expect(
      bandCreateSchema.safeParse({
        ...VALID_BAND,
        snsLinks: { "": "https://twitter.com/x" },
      }).success
    ).toBe(false);
  });

  it("11개 이상 거부 (최대 10)", () => {
    const links: Record<string, string> = {};
    for (let i = 0; i < 11; i += 1) {
      links[`k${i}`] = `https://example.com/${i}`;
    }
    expect(
      bandCreateSchema.safeParse({ ...VALID_BAND, snsLinks: links }).success
    ).toBe(false);
  });
});

describe("bandUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(bandUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("필수 빈 문자열 거부", () => {
    expect(bandUpdateSchema.safeParse({ slug: "" }).success).toBe(false);
    expect(bandUpdateSchema.safeParse({ nameKo: "" }).success).toBe(false);
    expect(bandUpdateSchema.safeParse({ nameJp: "" }).success).toBe(false);
  });

  it("workId 양의 정수만 허용", () => {
    expect(bandUpdateSchema.safeParse({ workId: 7 }).success).toBe(true);
    expect(bandUpdateSchema.safeParse({ workId: 0 }).success).toBe(false);
    expect(bandUpdateSchema.safeParse({ workId: -1 }).success).toBe(false);
  });

  it("snsLinks null 허용 (값 제거)", () => {
    expect(bandUpdateSchema.safeParse({ snsLinks: null }).success).toBe(true);
  });

  it("snsLinks 객체 허용", () => {
    expect(
      bandUpdateSchema.safeParse({
        snsLinks: { twitter: "https://twitter.com/x" },
      }).success
    ).toBe(true);
  });

  it("slug 형식 위반 거부", () => {
    expect(bandUpdateSchema.safeParse({ slug: "MyGO!" }).success).toBe(false);
  });
});
