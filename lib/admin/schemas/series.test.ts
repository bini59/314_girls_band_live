/**
 * Series Zod 스키마 단위 테스트.
 *
 * 검증 대상:
 *  - seriesCreateSchema   : slug kebab-case / nameKo·nameJp 필수 / nameEn·logoUrl·description 옵셔널
 *  - seriesUpdateSchema   : partial. 필수 필드 빈 문자열 거부. slug 형식 검증.
 */
import { describe, it, expect } from "vitest";

import { seriesCreateSchema, seriesUpdateSchema } from "./series";

const VALID_SERIES = {
  slug: "love-live",
  nameKo: "러브라이브",
  nameJp: "ラブライブ!",
};

describe("seriesCreateSchema — 성공 케이스", () => {
  it("필수 필드만 통과", () => {
    expect(seriesCreateSchema.safeParse(VALID_SERIES).success).toBe(true);
  });

  it("모든 필드 채운 풀 페이로드 통과", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        nameEn: "Love Live!",
        logoUrl: "https://example.com/logo.png",
        description: "시리즈 설명",
      }).success
    ).toBe(true);
  });

  it("옵셔널 필드 빈 문자열 허용", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        nameEn: "",
        logoUrl: "",
        description: "",
      }).success
    ).toBe(true);
  });
});

describe("seriesCreateSchema — 필수 필드 검증", () => {
  it.each([["slug"], ["nameKo"], ["nameJp"]])(
    "필수 필드 '%s' 누락 시 실패",
    (field) => {
      const input = { ...VALID_SERIES } as Record<string, unknown>;
      delete input[field];
      expect(seriesCreateSchema.safeParse(input).success).toBe(false);
    }
  );

  it.each([["slug"], ["nameKo"], ["nameJp"]])(
    "필수 필드 '%s' 가 빈 문자열이면 실패",
    (field) => {
      expect(
        seriesCreateSchema.safeParse({ ...VALID_SERIES, [field]: "" }).success
      ).toBe(false);
    }
  );
});

describe("seriesCreateSchema — slug 형식 검증", () => {
  it("대문자/언더스코어/공백/일본어 거부", () => {
    expect(
      seriesCreateSchema.safeParse({ ...VALID_SERIES, slug: "Love-Live" })
        .success
    ).toBe(false);
    expect(
      seriesCreateSchema.safeParse({ ...VALID_SERIES, slug: "love_live" })
        .success
    ).toBe(false);
    expect(
      seriesCreateSchema.safeParse({ ...VALID_SERIES, slug: "ラブライブ" })
        .success
    ).toBe(false);
  });

  it("slug 100자 초과 거부", () => {
    expect(
      seriesCreateSchema.safeParse({ ...VALID_SERIES, slug: "a".repeat(101) })
        .success
    ).toBe(false);
  });
});

describe("seriesCreateSchema — 길이 / URL 형식", () => {
  it("logoUrl 잘못된 URL 거부", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        logoUrl: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("logoUrl javascript: 스킴 거부", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        logoUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("nameKo / nameJp 100자 초과 거부", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        nameKo: "a".repeat(101),
      }).success
    ).toBe(false);
  });

  it("description 2000자 초과 거부", () => {
    expect(
      seriesCreateSchema.safeParse({
        ...VALID_SERIES,
        description: "a".repeat(2001),
      }).success
    ).toBe(false);
  });
});

describe("seriesUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(seriesUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("nameKo 만 변경", () => {
    expect(
      seriesUpdateSchema.safeParse({ nameKo: "수정된 러브라이브" }).success
    ).toBe(true);
  });

  it("필수 필드(slug) 빈 문자열로 덮어쓰기 거부", () => {
    const parsed = seriesUpdateSchema.safeParse({ slug: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.slug).toBeDefined();
    }
  });

  it("필수 필드(nameKo) 빈 문자열로 덮어쓰기 거부", () => {
    expect(seriesUpdateSchema.safeParse({ nameKo: "" }).success).toBe(false);
  });

  it("필수 필드(nameJp) 빈 문자열로 덮어쓰기 거부", () => {
    expect(seriesUpdateSchema.safeParse({ nameJp: "" }).success).toBe(false);
  });

  it("slug 형식 위반 거부", () => {
    expect(seriesUpdateSchema.safeParse({ slug: "Love-Live" }).success).toBe(
      false
    );
  });

  it("nameEn / logoUrl / description 빈 문자열 허용 (값 제거 의도)", () => {
    expect(
      seriesUpdateSchema.safeParse({ nameEn: "", logoUrl: "", description: "" })
        .success
    ).toBe(true);
  });
});
