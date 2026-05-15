/**
 * Tour Zod 스키마 단위 테스트.
 *
 * 검증:
 *  - tourCreateSchema   : workId / slug / nameKo / nameJp 필수.
 *                         날짜 둘 다 있으면 endsAt >= startsAt.
 *  - tourUpdateSchema   : partial. 필수 필드 빈 문자열 거부.
 *                         status / 날짜 / URL 검증은 동일.
 */
import { describe, it, expect } from "vitest";

import { tourCreateSchema, tourUpdateSchema } from "./tour";

const VALID_TOUR = {
  workId: 1,
  slug: "gakumas-tour-shirube",
  nameKo: "학원아이돌마스터 LIVE TOUR 標",
  nameJp: "学園アイドルマスター LIVE TOUR 標",
};

describe("tourCreateSchema — 성공 케이스", () => {
  it("필수 필드만 통과", () => {
    expect(tourCreateSchema.safeParse(VALID_TOUR).success).toBe(true);
  });

  it("nameEn / description / URL 들 포함 통과", () => {
    expect(
      tourCreateSchema.safeParse({
        ...VALID_TOUR,
        nameEn: "Gakumas LIVE TOUR Shirube",
        description: "전국 4도시 8회차 투어",
        posterUrl: "https://example.com/p.jpg",
        thumbnailUrl: "https://example.com/t.jpg",
        officialUrl: "https://example.com/tour",
        status: "PUBLISHED",
      }).success
    ).toBe(true);
  });

  it("startsAt / endsAt 정상 통과 (endsAt > startsAt)", () => {
    expect(
      tourCreateSchema.safeParse({
        ...VALID_TOUR,
        startsAtJst: "2026-08-20T18:30",
        endsAtJst: "2026-11-08T16:30",
      }).success
    ).toBe(true);
  });

  it("빈 문자열 옵셔널 필드 허용", () => {
    expect(
      tourCreateSchema.safeParse({
        ...VALID_TOUR,
        nameEn: "",
        description: "",
        posterUrl: "",
        thumbnailUrl: "",
        officialUrl: "",
        startsAtJst: "",
        endsAtJst: "",
      }).success
    ).toBe(true);
  });
});

describe("tourCreateSchema — 실패 케이스", () => {
  it("slug 대문자 거부", () => {
    const r = tourCreateSchema.safeParse({ ...VALID_TOUR, slug: "Tour-A" });
    expect(r.success).toBe(false);
  });

  it("nameKo 빈 문자열 거부", () => {
    const r = tourCreateSchema.safeParse({ ...VALID_TOUR, nameKo: "" });
    expect(r.success).toBe(false);
  });

  it("workId 0 거부", () => {
    const r = tourCreateSchema.safeParse({ ...VALID_TOUR, workId: 0 });
    expect(r.success).toBe(false);
  });

  it("workId 음수 거부", () => {
    const r = tourCreateSchema.safeParse({ ...VALID_TOUR, workId: -1 });
    expect(r.success).toBe(false);
  });

  it("workId 누락 거부", () => {
    const { workId: _omit, ...rest } = VALID_TOUR;
    void _omit;
    const r = tourCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("posterUrl 비-http(s) 거부", () => {
    const r = tourCreateSchema.safeParse({
      ...VALID_TOUR,
      posterUrl: "ftp://example.com/p.jpg",
    });
    expect(r.success).toBe(false);
  });

  it("endsAt < startsAt 거부", () => {
    const r = tourCreateSchema.safeParse({
      ...VALID_TOUR,
      startsAtJst: "2026-11-08T16:30",
      endsAtJst: "2026-08-20T18:30",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("endsAtJst"))).toBe(true);
    }
  });

  it("startsAt 의미상 무효 (월 13) 거부", () => {
    const r = tourCreateSchema.safeParse({
      ...VALID_TOUR,
      startsAtJst: "2026-13-01T18:30",
    });
    expect(r.success).toBe(false);
  });
});

describe("tourUpdateSchema — 성공 케이스", () => {
  it("빈 patch 통과", () => {
    expect(tourUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("부분 업데이트 (nameKo 만)", () => {
    expect(
      tourUpdateSchema.safeParse({ nameKo: "이름 변경" }).success
    ).toBe(true);
  });

  it("status 변경 통과", () => {
    expect(
      tourUpdateSchema.safeParse({ status: "PUBLISHED" }).success
    ).toBe(true);
  });
});

describe("tourUpdateSchema — 실패 케이스", () => {
  it("nameKo 빈 문자열 (필수 항목 비우기) 거부", () => {
    const r = tourUpdateSchema.safeParse({ nameKo: "" });
    expect(r.success).toBe(false);
  });

  it("slug 형식 위반 거부", () => {
    const r = tourUpdateSchema.safeParse({ slug: "Bad_Slug" });
    expect(r.success).toBe(false);
  });

  it("endsAt < startsAt patch 거부", () => {
    const r = tourUpdateSchema.safeParse({
      startsAtJst: "2026-11-08T16:30",
      endsAtJst: "2026-08-20T18:30",
    });
    expect(r.success).toBe(false);
  });
});
