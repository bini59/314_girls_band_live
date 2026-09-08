import { describe, expect, it } from "vitest";

import type { NavWork } from "@/lib/public/queries";

import { resolveActive } from "./site-shell";

const works = [
  {
    id: 1,
    slug: "bocchi",
    nameKo: "봇치 더 록",
    nameJp: "ぼっち・ざ・ろっく!",
    bands: [{ id: 10, slug: "kessoku", nameKo: "결속밴드", nameJp: "結束バンド" }],
  },
] as unknown as NavWork[];

describe("resolveActive", () => {
  it("밴드 경로는 밴드를 활성화하고 부모 작품을 브레드크럼에 넣는다", () => {
    expect(resolveActive("/bands/kessoku", works)).toEqual({
      activeId: "band-kessoku",
      trail: ["봇치 더 록", "결속밴드"],
    });
  });

  it("작품 경로는 작품을 활성화한다", () => {
    expect(resolveActive("/works/bocchi", works)).toEqual({
      activeId: "work-bocchi",
      trail: ["봇치 더 록"],
    });
  });

  it("상세 페이지는 캘린더(홈)를 활성 상태로 유지한다", () => {
    expect(resolveActive("/lives/some-live", works).activeId).toBe("home");
    expect(resolveActive("/tours/some-tour", works).activeId).toBe("home");
  });

  it("티켓사이트 경로", () => {
    expect(resolveActive("/ticket-sites", works).activeId).toBe("ticket-sites");
  });

  it("모르는 작품/밴드 slug 는 홈으로 폴백한다", () => {
    expect(resolveActive("/works/unknown", works).activeId).toBe("home");
    expect(resolveActive("/bands/unknown", works).activeId).toBe("home");
    expect(resolveActive("/", works).activeId).toBe("home");
  });
});
