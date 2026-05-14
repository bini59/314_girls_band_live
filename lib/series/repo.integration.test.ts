/**
 * Series 레포지토리 통합 테스트.
 *
 *  - CRUD + slug unique (P2002) → "이미 사용 중인 slug".
 *  - 삭제 시 Work.seriesId 는 onDelete: SetNull → 연결된 작품이 detach.
 *  - 존재하지 않는 id → "찾을 수 없".
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createSeries } from "@/test/factories/series";
import { createWorkRow } from "@/test/factories/work";

import {
  listSeries,
  getSeriesById,
  createSeries as createSeriesRepo,
  updateSeries,
  deleteSeries,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listSeries", () => {
  it("빈 DB → []", async () => {
    expect(await listSeries()).toEqual([]);
  });

  it("nameKo asc 정렬", async () => {
    await createSeries({ slug: "z-imas", nameKo: "아이마스" });
    await createSeries({ slug: "a-bandori", nameKo: "뱅드림" });
    await createSeries({ slug: "m-love", nameKo: "러브라이브" });

    const result = await listSeries();
    expect(result.map((s) => s.nameKo)).toEqual([
      "러브라이브",
      "뱅드림",
      "아이마스",
    ]);
  });
});

describe("getSeriesById", () => {
  it("존재하면 row", async () => {
    const s = await createSeries();
    const got = await getSeriesById(s.id);
    expect(got?.id).toBe(s.id);
  });

  it("존재하지 않으면 null", async () => {
    expect(await getSeriesById(999999)).toBeNull();
  });
});

describe("createSeries", () => {
  it("정상 생성", async () => {
    const s = await createSeriesRepo({
      slug: "love-live-create",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
      nameEn: "Love Live!",
    });
    expect(s.slug).toBe("love-live-create");
    expect(s.nameKo).toBe("러브라이브");
  });

  it("nameEn / logoUrl / description 옵셔널 (생략 가능)", async () => {
    const s = await createSeriesRepo({
      slug: "minimal-series",
      nameKo: "최소",
      nameJp: "ミニマル",
    });
    expect(s.nameEn).toBeNull();
    expect(s.logoUrl).toBeNull();
    expect(s.description).toBeNull();
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    await createSeriesRepo({
      slug: "dup-slug",
      nameKo: "first",
      nameJp: "first",
    });
    await expect(
      createSeriesRepo({
        slug: "dup-slug",
        nameKo: "second",
        nameJp: "second",
      })
    ).rejects.toThrow(/이미 사용 중인 slug/);
  });
});

describe("updateSeries", () => {
  it("부분 패치", async () => {
    const s = await createSeries();
    const updated = await updateSeries(s.id, { nameKo: "새 이름" });
    expect(updated.nameKo).toBe("새 이름");
    expect(updated.slug).toBe(s.slug);
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(updateSeries(999999, { nameKo: "x" })).rejects.toThrow(
      /찾을 수 없/
    );
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    const s1 = await createSeries({ slug: "occupied-slug" });
    const s2 = await createSeries({ slug: "another-slug" });

    await expect(updateSeries(s2.id, { slug: s1.slug })).rejects.toThrow(
      /이미 사용 중인 slug/
    );
  });
});

describe("deleteSeries", () => {
  it("정상 삭제", async () => {
    const s = await createSeries();
    await deleteSeries(s.id);
    expect(await getSeriesById(s.id)).toBeNull();
  });

  it("연결된 Work 는 detach 된다 (seriesId → null)", async () => {
    const s = await createSeries();
    const w = await createWorkRow({ seriesId: s.id });
    expect(w.seriesId).toBe(s.id);

    await deleteSeries(s.id);

    const work = await testDb.work.findUnique({ where: { id: w.id } });
    expect(work).not.toBeNull();
    expect(work!.seriesId).toBeNull();
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(deleteSeries(999999)).rejects.toThrow(/찾을 수 없/);
  });
});
