/**
 * Band 레포지토리 통합 테스트.
 *
 *  - searchBands: ILIKE 다국어 검색, 빈 입력 가드, limit clamp.
 *  - listBandsByIds: bulk 조회, 빈 배열 가드.
 *  - getBandById: 단건 조회.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, disconnectDb } from "@/test/helpers/db";
import { createBand } from "@/test/factories/band";

import { searchBands, listBandsByIds, getBandById } from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("searchBands", () => {
  it("빈 query → [] (전체 노출 방지)", async () => {
    await createBand({
      slug: "mygo-en-test",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
      nameEn: "MyGO!!!!!",
    });
    expect(await searchBands("")).toEqual([]);
    expect(await searchBands("   ")).toEqual([]);
  });

  it("nameKo ILIKE 매칭", async () => {
    await createBand({ slug: "b-ko-1", nameKo: "마이고", nameJp: "MyGO" });
    await createBand({ slug: "b-ko-2", nameKo: "토게토게", nameJp: "togenashi" });

    const result = await searchBands("마이");
    expect(result.map((b) => b.slug)).toEqual(["b-ko-1"]);
  });

  it("nameJp ILIKE 매칭 (대소문자 무시)", async () => {
    await createBand({ slug: "b-jp-1", nameKo: "k", nameJp: "MyGO!!!!!" });
    const result = await searchBands("mygo");
    expect(result.map((b) => b.slug)).toEqual(["b-jp-1"]);
  });

  it("nameEn ILIKE 매칭", async () => {
    await createBand({
      slug: "b-en-1",
      nameKo: "k",
      nameJp: "j",
      nameEn: "Roselia",
    });
    const result = await searchBands("rose");
    expect(result.map((b) => b.slug)).toEqual(["b-en-1"]);
  });

  it("slug ILIKE 매칭", async () => {
    await createBand({ slug: "afterglow-unique", nameKo: "k", nameJp: "j" });
    const result = await searchBands("afterglow");
    expect(result.map((b) => b.slug)).toEqual(["afterglow-unique"]);
  });

  it("매칭 없으면 []", async () => {
    await createBand();
    expect(await searchBands("존재하지않음xyz")).toEqual([]);
  });

  it("limit 적용", async () => {
    for (let i = 0; i < 5; i++) {
      await createBand({ slug: `lim-${i}`, nameKo: `검색대상-${i}`, nameJp: "j" });
    }
    const result = await searchBands("검색대상", 3);
    expect(result.length).toBe(3);
  });

  it("limit 50 초과 시 50 으로 clamp", async () => {
    for (let i = 0; i < 60; i++) {
      await createBand({ slug: `clamp-${i}`, nameKo: `clmp-${i}`, nameJp: "j" });
    }
    const result = await searchBands("clmp", 100);
    expect(result.length).toBeLessThanOrEqual(50);
  });
});

describe("listBandsByIds", () => {
  it("빈 배열 → []", async () => {
    expect(await listBandsByIds([])).toEqual([]);
  });

  it("주어진 id 들만 반환", async () => {
    const b1 = await createBand({ slug: "lb-1" });
    const b2 = await createBand({ slug: "lb-2" });
    const b3 = await createBand({ slug: "lb-3" });

    const result = await listBandsByIds([b1.id, b3.id]);
    expect(result.map((b) => b.id).sort()).toEqual([b1.id, b3.id].sort());
    expect(result.find((b) => b.id === b2.id)).toBeUndefined();
  });

  it("존재하지 않는 id 는 무시", async () => {
    const b = await createBand();
    const result = await listBandsByIds([b.id, 999999]);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe(b.id);
  });
});

describe("getBandById", () => {
  it("존재하면 row 반환", async () => {
    const b = await createBand();
    const got = await getBandById(b.id);
    expect(got?.id).toBe(b.id);
  });

  it("존재하지 않으면 null", async () => {
    expect(await getBandById(999999)).toBeNull();
  });
});
