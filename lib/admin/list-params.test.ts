import { describe, expect, it } from "vitest";

import {
  PAGE_SIZE,
  buildListQuery,
  lastPage,
  parseListParams,
  toPrismaPage,
} from "./list-params";

describe("parseListParams", () => {
  it("빈 입력 → page 1, q 없음", () => {
    expect(parseListParams({})).toEqual({ q: undefined, page: 1 });
  });

  it("q trim, 공백만이면 undefined", () => {
    expect(parseListParams({ q: "  결속  " }).q).toBe("결속");
    expect(parseListParams({ q: "   " }).q).toBeUndefined();
  });

  it("잘못된 page 는 1로 폴백", () => {
    for (const page of ["0", "-3", "1.5", "abc", ""]) {
      expect(parseListParams({ page }).page).toBe(1);
    }
  });

  it("배열 입력은 첫 값만 사용", () => {
    expect(parseListParams({ q: ["a", "b"], page: ["3", "9"] })).toEqual({
      q: "a",
      page: 3,
    });
  });
});

describe("toPrismaPage", () => {
  it("page 1 은 skip 0", () => {
    expect(toPrismaPage({ page: 1 })).toEqual({ skip: 0, take: PAGE_SIZE });
  });

  it("page 3 은 2페이지 분량을 건너뛴다", () => {
    expect(toPrismaPage({ page: 3 }).skip).toBe(PAGE_SIZE * 2);
  });
});

describe("lastPage", () => {
  it("0건이면 1", () => {
    expect(lastPage(0)).toBe(1);
  });

  it("정확히 나눠떨어지면 페이지를 추가하지 않는다", () => {
    expect(lastPage(PAGE_SIZE)).toBe(1);
    expect(lastPage(PAGE_SIZE + 1)).toBe(2);
  });
});

describe("buildListQuery", () => {
  it("기본값은 querystring 에 남기지 않는다", () => {
    expect(buildListQuery({ page: 1 }, {})).toBe("");
    expect(buildListQuery({ q: "a", page: 2 }, { q: undefined, page: 1 })).toBe(
      ""
    );
  });

  it("검색어를 바꾸면 page 는 호출자가 함께 지정한다", () => {
    expect(buildListQuery({ q: "old", page: 5 }, { q: "new", page: 1 })).toBe(
      "?q=new"
    );
  });

  it("q 를 유지하며 페이지만 이동", () => {
    expect(buildListQuery({ q: "결속", page: 1 }, { page: 2 })).toBe(
      `?q=${encodeURIComponent("결속")}&page=2`
    );
  });
});
