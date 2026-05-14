/**
 * Vendor Zod 스키마 단위 테스트 (RED — 구현 전/RED 확인용).
 *
 * 검증 대상:
 *  - vendorCreateSchema   : slug kebab-case / name 필수 / URL 형식 / 빈 문자열 허용
 *  - vendorUpdateSchema   : partial. 필수 필드 빈 문자열 거부. slug 형식 검증.
 */
import { describe, it, expect } from "vitest";

import { vendorCreateSchema, vendorUpdateSchema } from "./vendor";

const VALID_VENDOR = {
  slug: "eplus",
  name: "e+ (이플러스)",
};

describe("vendorCreateSchema — 성공 케이스", () => {
  it("slug + name 만 있는 최소 입력 통과", () => {
    expect(vendorCreateSchema.safeParse(VALID_VENDOR).success).toBe(true);
  });

  it("모든 필드 채운 풀 페이로드 통과", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        baseUrl: "https://eplus.jp/",
        logoUrl: "https://example.com/logo.png",
        notes: "수수료 별도",
      }).success
    ).toBe(true);
  });

  it("baseUrl / logoUrl / notes 빈 문자열 허용", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        baseUrl: "",
        logoUrl: "",
        notes: "",
      }).success
    ).toBe(true);
  });
});

describe("vendorCreateSchema — 필수 필드 검증", () => {
  it.each([["slug"], ["name"]])("필수 필드 '%s' 누락 시 실패", (field) => {
    const input = { ...VALID_VENDOR } as Record<string, unknown>;
    delete input[field];
    expect(vendorCreateSchema.safeParse(input).success).toBe(false);
  });

  it.each([["slug"], ["name"]])(
    "필수 필드 '%s' 가 빈 문자열이면 실패",
    (field) => {
      expect(
        vendorCreateSchema.safeParse({ ...VALID_VENDOR, [field]: "" }).success
      ).toBe(false);
    }
  );
});

describe("vendorCreateSchema — slug 형식 검증", () => {
  it("유효 kebab-case 통과", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "lawson-ticket" })
        .success
    ).toBe(true);
  });

  it("숫자 포함 kebab 통과", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "vendor-01" })
        .success
    ).toBe(true);
  });

  it("대문자 포함 거부", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "Eplus" }).success
    ).toBe(false);
  });

  it("언더스코어/공백 포함 거부", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "lawson_ticket" })
        .success
    ).toBe(false);
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "lawson ticket" })
        .success
    ).toBe(false);
  });

  it("일본어 포함 거부", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "ローソン" })
        .success
    ).toBe(false);
  });

  it("slug 100자 초과 거부", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, slug: "a".repeat(101) })
        .success
    ).toBe(false);
  });
});

describe("vendorCreateSchema — name / URL / notes 길이/형식", () => {
  it("name 100자 초과 거부", () => {
    expect(
      vendorCreateSchema.safeParse({ ...VALID_VENDOR, name: "a".repeat(101) })
        .success
    ).toBe(false);
  });

  it("baseUrl 잘못된 형식 거부", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        baseUrl: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("logoUrl 잘못된 형식 거부", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        logoUrl: "javascript:bad",
      }).success
    ).toBe(false);
  });

  it("baseUrl 500자 초과 거부", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        baseUrl: "https://example.com/" + "a".repeat(500),
      }).success
    ).toBe(false);
  });

  it("notes 1000자 초과 거부", () => {
    expect(
      vendorCreateSchema.safeParse({
        ...VALID_VENDOR,
        notes: "a".repeat(1001),
      }).success
    ).toBe(false);
  });
});

describe("vendorUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(vendorUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("name 만 변경", () => {
    expect(
      vendorUpdateSchema.safeParse({ name: "이플러스 (수정)" }).success
    ).toBe(true);
  });

  it("slug 만 변경 (kebab)", () => {
    expect(
      vendorUpdateSchema.safeParse({ slug: "eplus-new" }).success
    ).toBe(true);
  });

  it("slug 형식 위반 거부", () => {
    expect(
      vendorUpdateSchema.safeParse({ slug: "Eplus" }).success
    ).toBe(false);
  });

  it("필수 필드(slug) 빈 문자열로 덮어쓰기 거부", () => {
    const parsed = vendorUpdateSchema.safeParse({ slug: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.slug).toBeDefined();
    }
  });

  it("필수 필드(name) 빈 문자열로 덮어쓰기 거부", () => {
    const parsed = vendorUpdateSchema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.name).toBeDefined();
    }
  });

  it("baseUrl 잘못된 형식 거부", () => {
    expect(
      vendorUpdateSchema.safeParse({ baseUrl: "not-a-url" }).success
    ).toBe(false);
  });

  it("baseUrl 빈 문자열은 허용 (값 제거 의도)", () => {
    expect(
      vendorUpdateSchema.safeParse({ baseUrl: "" }).success
    ).toBe(true);
  });

  it("notes 1000자 초과 거부", () => {
    expect(
      vendorUpdateSchema.safeParse({ notes: "a".repeat(1001) }).success
    ).toBe(false);
  });
});
