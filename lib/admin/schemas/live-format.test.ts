/**
 * LiveFormat Zod 스키마 단위 테스트 (RED — 구현 전/RED 확인용).
 *
 * 검증 대상:
 *  - liveFormatTypeSchema     : enum 3종
 *  - liveFormatCreateSchema   : type 필수, 나머지는 빈 문자열/길이 제한 검증
 *  - liveFormatUpdateSchema   : 모든 필드 optional. 입력된 값은 동일 검증.
 */
import { describe, it, expect } from "vitest";

import {
  liveFormatCreateSchema,
  liveFormatTypeSchema,
  liveFormatUpdateSchema,
} from "./live-format";

describe("liveFormatTypeSchema", () => {
  it.each([["LIVE_VENUE"], ["LIVE_VIEWING"], ["STREAMING"]])(
    "'%s' 은 허용",
    (t) => {
      expect(liveFormatTypeSchema.safeParse(t).success).toBe(true);
    }
  );

  it("외부 값은 거부", () => {
    expect(liveFormatTypeSchema.safeParse("HYBRID").success).toBe(false);
    expect(liveFormatTypeSchema.safeParse("live_venue").success).toBe(false);
    expect(liveFormatTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("liveFormatCreateSchema — 성공 케이스", () => {
  it("type 만 있는 최소 입력 통과", () => {
    const parsed = liveFormatCreateSchema.safeParse({ type: "LIVE_VENUE" });
    expect(parsed.success).toBe(true);
  });

  it("모든 필드 채운 풀 페이로드 통과", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "LIVE_VIEWING",
      label: "전국 5관 LV",
      venueName: "ユナイテッド・シネマ豊洲",
      url: "https://liveviewing.jp/event/mygo",
    });
    expect(parsed.success).toBe(true);
  });

  it("STREAMING + 빈 venueName 통과 (배포는 장소 없는 게 일반)", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "STREAMING",
      label: "ABEMA 배포",
      venueName: "",
      url: "https://abema.tv/...",
    });
    expect(parsed.success).toBe(true);
  });

  it("label / venueName / url 모두 빈 문자열이어도 통과", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "LIVE_VENUE",
      label: "",
      venueName: "",
      url: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("liveFormatCreateSchema — 실패 케이스", () => {
  it("type 누락 시 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("type enum 위반 시 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({ type: "HYBRID" });
    expect(parsed.success).toBe(false);
  });

  it("label 이 200자 초과면 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "LIVE_VENUE",
      label: "a".repeat(201),
    });
    expect(parsed.success).toBe(false);
  });

  it("venueName 이 200자 초과면 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "LIVE_VENUE",
      venueName: "a".repeat(201),
    });
    expect(parsed.success).toBe(false);
  });

  it("url 이 올바르지 않은 형식이면 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "STREAMING",
      url: "not-a-url",
    });
    expect(parsed.success).toBe(false);
  });

  it("url 이 500자 초과면 실패", () => {
    const parsed = liveFormatCreateSchema.safeParse({
      type: "STREAMING",
      url: "https://example.com/" + "a".repeat(500),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("liveFormatUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(liveFormatUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("type 만 변경", () => {
    expect(
      liveFormatUpdateSchema.safeParse({ type: "STREAMING" }).success
    ).toBe(true);
  });

  it("label 만 변경", () => {
    expect(
      liveFormatUpdateSchema.safeParse({ label: "수정 라벨" }).success
    ).toBe(true);
  });

  it("입력된 type 은 enum 검증", () => {
    expect(
      liveFormatUpdateSchema.safeParse({ type: "INVALID" }).success
    ).toBe(false);
  });

  it("입력된 url 은 http(s) 만 허용", () => {
    // ftp / javascript / data 모두 거부 (보안: XSS 방지).
    expect(
      liveFormatUpdateSchema.safeParse({ url: "ftp://example.com" }).success
    ).toBe(false);
    expect(
      liveFormatUpdateSchema.safeParse({ url: "javascript:alert(1)" }).success
    ).toBe(false);
    expect(
      liveFormatUpdateSchema.safeParse({ url: "https://example.com" }).success
    ).toBe(true);
  });

  it("입력된 label 길이 검증", () => {
    expect(
      liveFormatUpdateSchema.safeParse({ label: "a".repeat(201) }).success
    ).toBe(false);
  });
});
