/**
 * LiveBand Zod 스키마 단위 테스트 (RED — 구현 전/RED 확인용).
 *
 * 검증 대상:
 *  - liveBandUpsertSchema   : bandId 필수+양의 정수 / isHeadliner 기본값 / order 기본값+0이상
 *  - liveBandReorderSchema  : 양의 정수 배열, 최소 1개
 */
import { describe, it, expect } from "vitest";

import {
  liveBandReorderSchema,
  liveBandUpsertSchema,
} from "./live-band";

describe("liveBandUpsertSchema — 성공 케이스", () => {
  it("bandId 만 있는 최소 입력이 통과 (isHeadliner=false, order=0 기본값)", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 1 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isHeadliner).toBe(false);
      expect(parsed.data.order).toBe(0);
    }
  });

  it("isHeadliner=true, order=5 명시도 통과", () => {
    const parsed = liveBandUpsertSchema.safeParse({
      bandId: 42,
      isHeadliner: true,
      order: 5,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("liveBandUpsertSchema — bandId 검증", () => {
  it("bandId 누락 시 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("bandId 가 문자열이면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: "1" });
    expect(parsed.success).toBe(false);
  });

  it("bandId 가 0 이면 실패 (positive)", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 0 });
    expect(parsed.success).toBe(false);
  });

  it("bandId 가 음수면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: -1 });
    expect(parsed.success).toBe(false);
  });

  it("bandId 가 소수면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 1.5 });
    expect(parsed.success).toBe(false);
  });
});

describe("liveBandUpsertSchema — isHeadliner 검증", () => {
  it("isHeadliner 가 문자열이면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({
      bandId: 1,
      isHeadliner: "true",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("liveBandUpsertSchema — order 검증", () => {
  it("order 가 음수면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 1, order: -1 });
    expect(parsed.success).toBe(false);
  });

  it("order 가 소수면 실패", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 1, order: 1.5 });
    expect(parsed.success).toBe(false);
  });

  it("order 가 0 은 통과", () => {
    const parsed = liveBandUpsertSchema.safeParse({ bandId: 1, order: 0 });
    expect(parsed.success).toBe(true);
  });
});

describe("liveBandReorderSchema", () => {
  it("정렬된 bandId 배열 통과", () => {
    const parsed = liveBandReorderSchema.safeParse([3, 1, 2]);
    expect(parsed.success).toBe(true);
  });

  it("빈 배열은 거부", () => {
    const parsed = liveBandReorderSchema.safeParse([]);
    expect(parsed.success).toBe(false);
  });

  it("배열이 아니면 거부", () => {
    const parsed = liveBandReorderSchema.safeParse({ 0: 1 });
    expect(parsed.success).toBe(false);
  });

  it("0 또는 음수 ID 포함 시 거부", () => {
    expect(liveBandReorderSchema.safeParse([1, 0, 2]).success).toBe(false);
    expect(liveBandReorderSchema.safeParse([1, -2]).success).toBe(false);
  });

  it("소수 포함 시 거부", () => {
    expect(liveBandReorderSchema.safeParse([1, 2.5]).success).toBe(false);
  });

  it("문자열 ID 포함 시 거부", () => {
    expect(liveBandReorderSchema.safeParse([1, "2"]).success).toBe(false);
  });
});
