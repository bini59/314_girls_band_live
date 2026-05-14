/**
 * Work Zod 스키마 단위 테스트.
 *
 * 검증:
 *  - workCreateSchema   : slug, nameKo, nameJp 필수. seriesId 옵셔널 정수(>0). kind 자유 텍스트.
 *  - workUpdateSchema   : partial. 필수 필드 빈 문자열 거부. seriesId null/undefined 허용.
 */
import { describe, it, expect } from "vitest";

import { workCreateSchema, workUpdateSchema } from "./work";

const VALID_WORK = {
  slug: "love-live",
  nameKo: "러브라이브!",
  nameJp: "ラブライブ!",
};

describe("workCreateSchema — 성공 케이스", () => {
  it("필수 필드만 통과", () => {
    expect(workCreateSchema.safeParse(VALID_WORK).success).toBe(true);
  });

  it("seriesId 포함 통과", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: 1 }).success
    ).toBe(true);
  });

  it("seriesId null 허용", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: null }).success
    ).toBe(true);
  });

  it("모든 필드 채운 풀 페이로드", () => {
    expect(
      workCreateSchema.safeParse({
        ...VALID_WORK,
        nameEn: "Love Live!",
        kind: "anime",
        logoUrl: "https://example.com/logo.png",
        description: "작품 설명",
        seriesId: 5,
      }).success
    ).toBe(true);
  });

  it("옵셔널 빈 문자열 허용", () => {
    expect(
      workCreateSchema.safeParse({
        ...VALID_WORK,
        nameEn: "",
        kind: "",
        logoUrl: "",
        description: "",
      }).success
    ).toBe(true);
  });
});

describe("workCreateSchema — 필수 검증", () => {
  it.each([["slug"], ["nameKo"], ["nameJp"]])(
    "필수 '%s' 누락 실패",
    (field) => {
      const input = { ...VALID_WORK } as Record<string, unknown>;
      delete input[field];
      expect(workCreateSchema.safeParse(input).success).toBe(false);
    }
  );

  it.each([["slug"], ["nameKo"], ["nameJp"]])(
    "필수 '%s' 빈 문자열 실패",
    (field) => {
      expect(
        workCreateSchema.safeParse({ ...VALID_WORK, [field]: "" }).success
      ).toBe(false);
    }
  );
});

describe("workCreateSchema — slug 형식", () => {
  it("대문자/공백/일본어 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, slug: "Love-Live" }).success
    ).toBe(false);
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, slug: "love live" }).success
    ).toBe(false);
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, slug: "ラブライブ" }).success
    ).toBe(false);
  });
});

describe("workCreateSchema — seriesId 검증", () => {
  it("음수 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: -1 }).success
    ).toBe(false);
  });

  it("0 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: 0 }).success
    ).toBe(false);
  });

  it("소수점 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: 1.5 }).success
    ).toBe(false);
  });

  it("문자열 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, seriesId: "1" }).success
    ).toBe(false);
  });
});

describe("workCreateSchema — 길이 / URL", () => {
  it("kind 50자 초과 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, kind: "a".repeat(51) })
        .success
    ).toBe(false);
  });

  it("logoUrl 잘못된 URL 거부", () => {
    expect(
      workCreateSchema.safeParse({ ...VALID_WORK, logoUrl: "not-a-url" })
        .success
    ).toBe(false);
  });

  it("logoUrl javascript: 거부", () => {
    expect(
      workCreateSchema.safeParse({
        ...VALID_WORK,
        logoUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("description 2000자 초과 거부", () => {
    expect(
      workCreateSchema.safeParse({
        ...VALID_WORK,
        description: "a".repeat(2001),
      }).success
    ).toBe(false);
  });
});

describe("workUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(workUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("필수 필드 빈 문자열 거부", () => {
    expect(workUpdateSchema.safeParse({ slug: "" }).success).toBe(false);
    expect(workUpdateSchema.safeParse({ nameKo: "" }).success).toBe(false);
    expect(workUpdateSchema.safeParse({ nameJp: "" }).success).toBe(false);
  });

  it("seriesId null 허용 (시리즈에서 분리)", () => {
    expect(workUpdateSchema.safeParse({ seriesId: null }).success).toBe(true);
  });

  it("seriesId 양의 정수 허용", () => {
    expect(workUpdateSchema.safeParse({ seriesId: 7 }).success).toBe(true);
  });

  it("seriesId 음수 거부", () => {
    expect(workUpdateSchema.safeParse({ seriesId: -1 }).success).toBe(false);
  });

  it("slug 형식 위반 거부", () => {
    expect(workUpdateSchema.safeParse({ slug: "Love Live" }).success).toBe(
      false
    );
  });

  it("nameEn / logoUrl / description / kind 빈 문자열 허용", () => {
    expect(
      workUpdateSchema.safeParse({
        nameEn: "",
        kind: "",
        logoUrl: "",
        description: "",
      }).success
    ).toBe(true);
  });
});
