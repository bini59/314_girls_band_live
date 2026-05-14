/**
 * Work 레포지토리 통합 테스트.
 *
 *  - CRUD + slug unique (P2002) → "이미 사용 중인 slug".
 *  - seriesId 가 존재하지 않으면 P2003 → "존재하지 않는 시리즈".
 *  - 삭제 시 Band.workId onDelete: Restrict → P2003 → "사용 중인 작품".
 *  - listWorks 는 Series include + nameKo asc.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createSeries } from "@/test/factories/series";
import { createWorkRow } from "@/test/factories/work";
import { createBand } from "@/test/factories/band";

import {
  listWorks,
  getWorkById,
  createWork,
  updateWork,
  deleteWork,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listWorks", () => {
  it("빈 DB → []", async () => {
    expect(await listWorks()).toEqual([]);
  });

  it("nameKo asc 정렬 + series include", async () => {
    const lv = await createSeries({ slug: "lv-series", nameKo: "러브라이브 시리즈" });
    await createWorkRow({
      slug: "z-imas",
      nameKo: "아이마스",
      nameJp: "アイマス",
    });
    await createWorkRow({
      slug: "a-lovelive",
      nameKo: "러브라이브!",
      nameJp: "ラブライブ!",
      seriesId: lv.id,
    });
    await createWorkRow({
      slug: "m-bandori",
      nameKo: "뱅드림",
      nameJp: "バンドリ!",
    });

    const result = await listWorks();
    expect(result.map((w) => w.nameKo)).toEqual([
      "러브라이브!",
      "뱅드림",
      "아이마스",
    ]);
    expect(result[0].series?.nameKo).toBe("러브라이브 시리즈");
    expect(result[1].series).toBeNull();
  });
});

describe("getWorkById", () => {
  it("존재하면 row (series include)", async () => {
    const s = await createSeries();
    const w = await createWorkRow({ seriesId: s.id });
    const got = await getWorkById(w.id);
    expect(got?.id).toBe(w.id);
    expect(got?.series?.id).toBe(s.id);
  });

  it("존재하지 않으면 null", async () => {
    expect(await getWorkById(999999)).toBeNull();
  });
});

describe("createWork", () => {
  it("정상 생성 (seriesId 있음)", async () => {
    const s = await createSeries();
    const w = await createWork({
      slug: "lovelive-create",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
      seriesId: s.id,
    });
    expect(w.slug).toBe("lovelive-create");
    expect(w.seriesId).toBe(s.id);
  });

  it("정상 생성 (seriesId null)", async () => {
    const w = await createWork({
      slug: "standalone-work",
      nameKo: "단일",
      nameJp: "スタンドアロン",
    });
    expect(w.seriesId).toBeNull();
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    await createWork({
      slug: "dup-slug",
      nameKo: "first",
      nameJp: "first",
    });
    await expect(
      createWork({
        slug: "dup-slug",
        nameKo: "second",
        nameJp: "second",
      })
    ).rejects.toThrow(/이미 사용 중인 slug/);
  });

  it("존재하지 않는 seriesId → throw '존재하지 않는 시리즈'", async () => {
    await expect(
      createWork({
        slug: "orphan-work",
        nameKo: "고아",
        nameJp: "孤児",
        seriesId: 999999,
      })
    ).rejects.toThrow(/존재하지 않는 시리즈/);
  });
});

describe("updateWork", () => {
  it("부분 패치", async () => {
    const w = await createWorkRow();
    const updated = await updateWork(w.id, { nameKo: "새 이름" });
    expect(updated.nameKo).toBe("새 이름");
    expect(updated.slug).toBe(w.slug);
  });

  it("seriesId 를 null 로 변경 가능", async () => {
    const s = await createSeries();
    const w = await createWorkRow({ seriesId: s.id });
    const updated = await updateWork(w.id, { seriesId: null });
    expect(updated.seriesId).toBeNull();
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(updateWork(999999, { nameKo: "x" })).rejects.toThrow(
      /찾을 수 없/
    );
  });

  it("존재하지 않는 seriesId → throw '존재하지 않는 시리즈'", async () => {
    const w = await createWorkRow();
    await expect(
      updateWork(w.id, { seriesId: 999999 })
    ).rejects.toThrow(/존재하지 않는 시리즈/);
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    const w1 = await createWorkRow({ slug: "occupied-slug" });
    const w2 = await createWorkRow({ slug: "another-slug" });

    await expect(updateWork(w2.id, { slug: w1.slug })).rejects.toThrow(
      /이미 사용 중인 slug/
    );
  });
});

describe("deleteWork", () => {
  it("정상 삭제 (밴드 없음)", async () => {
    const w = await createWorkRow();
    await deleteWork(w.id);
    expect(await getWorkById(w.id)).toBeNull();
  });

  it("연결된 Band 가 있으면 throw '사용 중인 작품'", async () => {
    const w = await createWorkRow();
    await createBand({ workId: w.id });

    await expect(deleteWork(w.id)).rejects.toThrow(/사용 중인 작품/);
    expect(await getWorkById(w.id)).not.toBeNull();
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(deleteWork(999999)).rejects.toThrow(/찾을 수 없/);
  });
});
