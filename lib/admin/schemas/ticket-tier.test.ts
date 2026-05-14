/**
 * TicketTier Zod 스키마 단위 테스트 (RED — 구현 전/RED 확인용).
 *
 * 검증 대상:
 *  - ticketTierCreateSchema   : name 필수 / priceJpy >=0 정수 / order >=0 정수 / notes 길이
 *  - ticketTierUpdateSchema   : partial. name 빈 문자열 거부.
 *  - ticketTierReorderSchema  : 양의 정수 배열, 최소 1개
 */
import { describe, it, expect } from "vitest";

import {
  ticketTierCreateSchema,
  ticketTierReorderSchema,
  ticketTierUpdateSchema,
} from "./ticket-tier";

const VALID_TIER = {
  name: "S석 지정",
  priceJpy: 9800,
};

describe("ticketTierCreateSchema — 성공 케이스", () => {
  it("필수 필드(name, priceJpy)만 있는 최소 입력 통과 (order 기본값 0)", () => {
    const parsed = ticketTierCreateSchema.safeParse(VALID_TIER);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.order).toBe(0);
    }
  });

  it("notes / order 명시 입력 통과", () => {
    const parsed = ticketTierCreateSchema.safeParse({
      ...VALID_TIER,
      notes: "본인확인 필수",
      order: 3,
    });
    expect(parsed.success).toBe(true);
  });

  it("priceJpy = 0 (무료석) 통과", () => {
    const parsed = ticketTierCreateSchema.safeParse({
      name: "招待席",
      priceJpy: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("notes 빈 문자열 허용", () => {
    const parsed = ticketTierCreateSchema.safeParse({
      ...VALID_TIER,
      notes: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("ticketTierCreateSchema — 실패 케이스", () => {
  it.each([["name"], ["priceJpy"]])("필수 필드 '%s' 누락 시 실패", (field) => {
    const input = { ...VALID_TIER } as Record<string, unknown>;
    delete input[field];
    expect(ticketTierCreateSchema.safeParse(input).success).toBe(false);
  });

  it("name 이 빈 문자열이면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, name: "" }).success
    ).toBe(false);
  });

  it("name 이 100자 초과면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({
        ...VALID_TIER,
        name: "a".repeat(101),
      }).success
    ).toBe(false);
  });

  it("priceJpy 가 음수면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, priceJpy: -100 })
        .success
    ).toBe(false);
  });

  it("priceJpy 가 소수면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, priceJpy: 9800.5 })
        .success
    ).toBe(false);
  });

  it("priceJpy 가 문자열이면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, priceJpy: "9800" })
        .success
    ).toBe(false);
  });

  it("order 가 음수면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, order: -1 }).success
    ).toBe(false);
  });

  it("order 가 소수면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({ ...VALID_TIER, order: 1.5 }).success
    ).toBe(false);
  });

  it("notes 가 1000자 초과면 실패", () => {
    expect(
      ticketTierCreateSchema.safeParse({
        ...VALID_TIER,
        notes: "a".repeat(1001),
      }).success
    ).toBe(false);
  });
});

describe("ticketTierUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(ticketTierUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("name 만 변경 통과", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ name: "A석" }).success
    ).toBe(true);
  });

  it("priceJpy 만 변경 통과", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ priceJpy: 12000 }).success
    ).toBe(true);
  });

  it("name 을 명시적 빈 문자열로 보내면 거부", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ name: "" }).success
    ).toBe(false);
  });

  it("priceJpy 가 음수면 거부", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ priceJpy: -1 }).success
    ).toBe(false);
  });

  it("order 가 음수면 거부", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ order: -1 }).success
    ).toBe(false);
  });

  it("notes 가 1000자 초과면 거부", () => {
    expect(
      ticketTierUpdateSchema.safeParse({ notes: "a".repeat(1001) }).success
    ).toBe(false);
  });
});

describe("ticketTierReorderSchema", () => {
  it("정렬된 tier id 배열 통과", () => {
    expect(ticketTierReorderSchema.safeParse([5, 3, 2]).success).toBe(true);
  });

  it("빈 배열 거부", () => {
    expect(ticketTierReorderSchema.safeParse([]).success).toBe(false);
  });

  it("0 또는 음수 ID 포함 시 거부", () => {
    expect(ticketTierReorderSchema.safeParse([1, 0]).success).toBe(false);
    expect(ticketTierReorderSchema.safeParse([1, -2]).success).toBe(false);
  });

  it("소수 포함 시 거부", () => {
    expect(ticketTierReorderSchema.safeParse([1, 2.5]).success).toBe(false);
  });

  it("문자열 ID 포함 시 거부", () => {
    expect(ticketTierReorderSchema.safeParse(["1", "2"]).success).toBe(false);
  });
});
