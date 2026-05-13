import { describe, it, expect } from "vitest";
import { slugify, ensureUniqueSlug } from "./slug";

describe("slugify - ASCII kebab-case 변환", () => {
  it("'Hello World' → 'hello-world'", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("연속 공백은 단일 하이픈", () => {
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
  });

  it("언더스코어는 하이픈으로", () => {
    expect(slugify("With_Underscore")).toBe("with-underscore");
  });

  it("연속 구분자(하이픈/언더스코어)는 단일 하이픈", () => {
    expect(slugify("Hyphens---and___underscores")).toBe(
      "hyphens-and-underscores"
    );
  });

  it("앞뒤 하이픈은 제거", () => {
    expect(slugify("-hello-")).toBe("hello");
  });

  it("숫자는 유지", () => {
    expect(slugify("123 Numbers ok")).toBe("123-numbers-ok");
  });

  it("특수문자 제거", () => {
    expect(slugify("Punc!@#$%")).toBe("punc");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(slugify("")).toBe("");
  });
});

describe("slugify - 비ASCII 처리", () => {
  it("일본어/이모지 등 비ASCII 는 제거", () => {
    expect(slugify("MyGO!!!!! 結束バンド")).toBe("mygo");
  });

  it("한글만 있으면 빈 문자열 (호출자가 수동 입력 강제 신호로 사용)", () => {
    expect(slugify("러브라이브 라이브")).toBe("");
  });

  it("μ's 같은 비ASCII + apostrophe 는 제거 후 영어만 남음", () => {
    // apostrophe 는 단어 경계가 아니라 제거 (영문 slug 라이브러리 관례).
    // μ 는 비-ASCII 라 경계로 처리 → 결국 "s-final-lovelive".
    expect(slugify("μ's Final LoveLive!")).toBe("s-final-lovelive");
  });

  it("복합 케이스: BanG Dream + 일본어 → 영어 슬러그 (apostrophe 제거)", () => {
    // "BanG Dream! It's MyGO!!!!! 「迷星叫」" 에서 apostrophe 는 제거
    // (it's → its), 느낌표/일본어는 경계 → "bang-dream-its-mygo".
    expect(slugify("BanG Dream! It's MyGO!!!!! 「迷星叫」")).toBe(
      "bang-dream-its-mygo"
    );
  });

  it("curly apostrophe(’) 도 동일하게 제거", () => {
    expect(slugify("It’s Cool")).toBe("its-cool");
  });
});

describe("ensureUniqueSlug - 충돌 회피", () => {
  it("exists 가 항상 false 면 base 그대로", async () => {
    const result = await ensureUniqueSlug("foo", async () => false);
    expect(result).toBe("foo");
  });

  it("base 가 존재하면 -2 suffix", async () => {
    const exists = async (s: string) => s === "foo";
    const result = await ensureUniqueSlug("foo", exists);
    expect(result).toBe("foo-2");
  });

  it("base 와 -2 가 존재하면 -3 suffix", async () => {
    const exists = async (s: string) => s === "foo" || s === "foo-2";
    const result = await ensureUniqueSlug("foo", exists);
    expect(result).toBe("foo-3");
  });

  it("순차적으로 충돌 → 첫 빈 자리 사용", async () => {
    const taken = new Set(["foo", "foo-2", "foo-3", "foo-4"]);
    const result = await ensureUniqueSlug("foo", async (s) => taken.has(s));
    expect(result).toBe("foo-5");
  });

  it("100회 시도(또는 합리적 상한) 후에도 충돌이면 throw", async () => {
    await expect(
      ensureUniqueSlug("foo", async () => true)
    ).rejects.toThrow();
  });

  it("base 가 빈 문자열이면 즉시 throw — exists 호출 없이", async () => {
    let calls = 0;
    const exists = async (_s: string) => {
      calls++;
      return false;
    };
    await expect(ensureUniqueSlug("", exists)).rejects.toThrow(
      /base slug is empty/
    );
    expect(calls).toBe(0);
  });
});
