/**
 * Tour 레포지토리 통합 테스트.
 *
 *  - CRUD + slug unique (P2002) → "이미 사용 중인 slug".
 *  - workId 가 존재하지 않으면 P2003 → "존재하지 않는 작품".
 *  - Tour 삭제 시 Live.tourId 는 onDelete: SetNull → Live 는 살아남고 tourId 만 NULL.
 *  - listTours 는 work include + lives count + nameKo asc.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { testDb, resetDb, disconnectDb } from "@/test/helpers/db";
import { createWorkRow } from "@/test/factories/work";
import { createTour } from "@/test/factories/tour";
import { createLive } from "@/test/factories/live";

import {
  listTours,
  listToursByWorkId,
  getTourById,
  getTourBySlug,
  createTour as createTourRepo,
  updateTour,
  deleteTour,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listTours", () => {
  it("빈 DB → []", async () => {
    expect(await listTours()).toEqual([]);
  });

  it("nameKo asc 정렬 + work include + _count.lives", async () => {
    const work = await createWorkRow({
      slug: "gakumas",
      nameKo: "학원아이돌마스터",
      nameJp: "学園アイドルマスター",
    });
    const z = await createTour({
      workId: work.id,
      slug: "z-tour",
      nameKo: "ㅎ 투어",
      nameJp: "Z ツアー",
    });
    const a = await createTour({
      workId: work.id,
      slug: "a-tour",
      nameKo: "ㄱ 투어",
      nameJp: "A ツアー",
    });
    // a 에만 회차 1개 매달기
    await createLive({ tourId: a.id });

    const rows = await listTours();
    expect(rows.map((r) => r.id)).toEqual([a.id, z.id]);
    expect(rows[0].work.id).toBe(work.id);
    expect(rows[0]._count.lives).toBe(1);
    expect(rows[1]._count.lives).toBe(0);
  });
});

describe("listToursByWorkId", () => {
  it("해당 work 의 tours 만 반환", async () => {
    const w1 = await createWorkRow({ slug: "w1", nameKo: "W1", nameJp: "W1" });
    const w2 = await createWorkRow({ slug: "w2", nameKo: "W2", nameJp: "W2" });
    const t1 = await createTour({ workId: w1.id, slug: "t1", nameKo: "T1", nameJp: "T1" });
    await createTour({ workId: w2.id, slug: "t2", nameKo: "T2", nameJp: "T2" });

    const rows = await listToursByWorkId(w1.id);
    expect(rows.map((r) => r.id)).toEqual([t1.id]);
  });
});

describe("getTourById / getTourBySlug", () => {
  it("not found → null", async () => {
    expect(await getTourById(9999)).toBeNull();
    expect(await getTourBySlug("no-such-tour")).toBeNull();
  });

  it("found → work include", async () => {
    const work = await createWorkRow({
      slug: "bocchi",
      nameKo: "봇치 더 록",
      nameJp: "ぼっち・ざ・ろっく",
    });
    const t = await createTour({
      workId: work.id,
      slug: "kessoku-we-will-b",
      nameKo: "결속밴드 We will B",
      nameJp: "結束バンド We will B",
    });
    const byId = await getTourById(t.id);
    expect(byId?.work.id).toBe(work.id);
    const bySlug = await getTourBySlug(t.slug);
    expect(bySlug?.work.id).toBe(work.id);
  });
});

describe("createTour", () => {
  it("정상 생성 (status 기본 DRAFT)", async () => {
    const work = await createWorkRow({ slug: "w-c", nameKo: "W", nameJp: "W" });
    const t = await createTourRepo({
      workId: work.id,
      slug: "new-tour",
      nameKo: "신규 투어",
      nameJp: "新規ツアー",
    });
    expect(t.id).toBeTruthy();
    expect(t.status).toBe("DRAFT");
  });

  it("status PUBLISHED 지정 가능", async () => {
    const work = await createWorkRow({ slug: "w-pp", nameKo: "W", nameJp: "W" });
    const t = await createTourRepo({
      workId: work.id,
      slug: "pub-tour",
      nameKo: "공개",
      nameJp: "公開",
      status: "PUBLISHED",
    });
    expect(t.status).toBe("PUBLISHED");
  });

  it("slug 중복 → '이미 사용 중인 slug'", async () => {
    const work = await createWorkRow({ slug: "w-d", nameKo: "W", nameJp: "W" });
    await createTour({ workId: work.id, slug: "dup-slug", nameKo: "A", nameJp: "A" });
    await expect(
      createTourRepo({
        workId: work.id,
        slug: "dup-slug",
        nameKo: "B",
        nameJp: "B",
      })
    ).rejects.toThrow(/이미 사용 중인 slug/);
  });

  it("workId FK 실패 → '존재하지 않는 작품'", async () => {
    await expect(
      createTourRepo({
        workId: 99999,
        slug: "orphan",
        nameKo: "고아",
        nameJp: "孤児",
      })
    ).rejects.toThrow(/존재하지 않는 작품/);
  });
});

describe("updateTour", () => {
  it("부분 업데이트 (nameKo)", async () => {
    const work = await createWorkRow({ slug: "w-u", nameKo: "W", nameJp: "W" });
    const t = await createTour({
      workId: work.id,
      slug: "u-tour",
      nameKo: "원래 이름",
      nameJp: "原",
    });
    const u = await updateTour(t.id, { nameKo: "수정됨" });
    expect(u.nameKo).toBe("수정됨");
  });

  it("not-found → throw", async () => {
    await expect(updateTour(9999, { nameKo: "X" })).rejects.toThrow(
      /Tour\(id=9999\) 를 찾을 수 없/
    );
  });

  it("slug 중복 → '이미 사용 중인 slug'", async () => {
    const work = await createWorkRow({ slug: "w-uu", nameKo: "W", nameJp: "W" });
    await createTour({ workId: work.id, slug: "first", nameKo: "F", nameJp: "F" });
    const t2 = await createTour({
      workId: work.id,
      slug: "second",
      nameKo: "S",
      nameJp: "S",
    });
    await expect(updateTour(t2.id, { slug: "first" })).rejects.toThrow(
      /이미 사용 중인 slug/
    );
  });
});

describe("deleteTour", () => {
  it("정상 삭제", async () => {
    const work = await createWorkRow({ slug: "w-dx", nameKo: "W", nameJp: "W" });
    const t = await createTour({
      workId: work.id,
      slug: "del",
      nameKo: "삭제 대상",
      nameJp: "削除",
    });
    await deleteTour(t.id);
    expect(await getTourById(t.id)).toBeNull();
  });

  it("연결된 Live 가 있어도 삭제 가능 (Live.tourId SetNull)", async () => {
    const work = await createWorkRow({ slug: "w-sn", nameKo: "W", nameJp: "W" });
    const t = await createTour({
      workId: work.id,
      slug: "with-live",
      nameKo: "투어",
      nameJp: "ツアー",
    });
    const live = await createLive({ tourId: t.id });
    await deleteTour(t.id);

    // Tour 는 사라졌지만 Live 는 보존되고 tourId 만 NULL.
    const survived = await testDb.live.findUnique({ where: { id: live.id } });
    expect(survived).not.toBeNull();
    expect(survived?.tourId).toBeNull();
  });

  it("not-found → throw", async () => {
    await expect(deleteTour(9999)).rejects.toThrow(/Tour\(id=9999\) 를 찾을 수 없/);
  });
});

describe("Work 삭제 vs Tour", () => {
  it("Tour 가 매달린 Work 는 삭제 불가 (Restrict)", async () => {
    const work = await createWorkRow({ slug: "w-r", nameKo: "W", nameJp: "W" });
    await createTour({ workId: work.id, slug: "blocking", nameKo: "B", nameJp: "B" });

    await expect(
      testDb.work.delete({ where: { id: work.id } })
    ).rejects.toThrow();
  });
});
