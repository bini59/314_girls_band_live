/**
 * coerceSnsLinks 단위 테스트.
 */
import { describe, it, expect } from "vitest";

import { coerceSnsLinks } from "./sns-links";

describe("coerceSnsLinks", () => {
  it("null / undefined → null", () => {
    expect(coerceSnsLinks(null)).toBeNull();
    expect(coerceSnsLinks(undefined)).toBeNull();
  });

  it("정상 Record → 그대로 반환", () => {
    expect(
      coerceSnsLinks({
        twitter: "https://twitter.com/x",
        youtube: "https://youtube.com/@x",
      })
    ).toEqual({
      twitter: "https://twitter.com/x",
      youtube: "https://youtube.com/@x",
    });
  });

  it("빈 객체 → null (UI 공백 일관성)", () => {
    expect(coerceSnsLinks({})).toBeNull();
  });

  it("배열 → null", () => {
    expect(coerceSnsLinks(["https://twitter.com/x"])).toBeNull();
  });

  it("스칼라 → null", () => {
    expect(coerceSnsLinks("string")).toBeNull();
    expect(coerceSnsLinks(42)).toBeNull();
    expect(coerceSnsLinks(true)).toBeNull();
  });

  it("중첩 객체 값은 제거되고 정상 값만 보존", () => {
    expect(
      coerceSnsLinks({
        twitter: "https://twitter.com/x",
        bad: { nested: "x" },
        deeper: { a: { b: 1 } },
      })
    ).toEqual({
      twitter: "https://twitter.com/x",
    });
  });

  it("빈 문자열 키 → 제거", () => {
    expect(
      coerceSnsLinks({
        "": "https://twitter.com/x",
        twitter: "https://twitter.com/y",
      })
    ).toEqual({
      twitter: "https://twitter.com/y",
    });
  });

  it("non-string 값 → 제거", () => {
    expect(
      coerceSnsLinks({
        twitter: "https://twitter.com/x",
        bad: 42,
        worse: null,
      })
    ).toEqual({
      twitter: "https://twitter.com/x",
    });
  });

  it("모든 항목이 잘못되면 null", () => {
    expect(
      coerceSnsLinks({
        "": "https://twitter.com/x",
        bad: 42,
      })
    ).toBeNull();
  });
});
