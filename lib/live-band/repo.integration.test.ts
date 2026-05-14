/**
 * LiveBand 레포지토리 통합 테스트.
 *
 * 라인업 (Live ↔ Band N:M) 의 추가 / 갱신 / 제거 / 재정렬.
 *  - composite PK (liveId, bandId) 의 unique violation 처리.
 *  - 멱등 remove (없어도 OK).
 *  - reorder 의 cross-live 가드 + 트랜잭션.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createBand } from "@/test/factories/band";

import {
  listLiveBands,
  addLiveBand,
  updateLiveBand,
  removeLiveBand,
  reorderLiveBands,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("addLiveBand", () => {
  it("정상 추가", async () => {
    const live = await createLive();
    const band = await createBand();

    const row = await addLiveBand({ liveId: live.id, bandId: band.id });
    expect(row.liveId).toBe(live.id);
    expect(row.bandId).toBe(band.id);
    expect(row.isHeadliner).toBe(false);
    expect(row.order).toBe(0);
  });

  it("isHeadliner / order 전달", async () => {
    const live = await createLive();
    const band = await createBand();
    const row = await addLiveBand({
      liveId: live.id,
      bandId: band.id,
      isHeadliner: true,
      order: 3,
    });
    expect(row.isHeadliner).toBe(true);
    expect(row.order).toBe(3);
  });

  it("동일 (liveId, bandId) 중복 → throw '이미 추가된 밴드'", async () => {
    const live = await createLive();
    const band = await createBand();
    await addLiveBand({ liveId: live.id, bandId: band.id });
    await expect(
      addLiveBand({ liveId: live.id, bandId: band.id })
    ).rejects.toThrow(/이미 추가된 밴드/);
  });
});

describe("listLiveBands", () => {
  it("빈 라이브 → []", async () => {
    const live = await createLive();
    expect(await listLiveBands(live.id)).toEqual([]);
  });

  it("order asc, then bandId asc 로 정렬 + band include", async () => {
    const live = await createLive();
    const b1 = await createBand({ slug: "b-1" });
    const b2 = await createBand({ slug: "b-2" });
    const b3 = await createBand({ slug: "b-3" });

    await addLiveBand({ liveId: live.id, bandId: b2.id, order: 1 });
    await addLiveBand({ liveId: live.id, bandId: b1.id, order: 0 });
    await addLiveBand({ liveId: live.id, bandId: b3.id, order: 1 });

    const result = await listLiveBands(live.id);
    // order 0 → b1, order 1 + bandId asc → b2 then b3
    expect(result.map((r) => r.bandId)).toEqual([b1.id, b2.id, b3.id]);
    // band include 확인
    expect(result[0]!.band.id).toBe(b1.id);
    expect(result[0]!.band.slug).toBe("b-1");
  });

  it("다른 라이브의 라인업은 보이지 않는다", async () => {
    const liveA = await createLive({ slug: "live-a" });
    const liveB = await createLive({ slug: "live-b" });
    const band = await createBand();
    await addLiveBand({ liveId: liveA.id, bandId: band.id });

    expect(await listLiveBands(liveB.id)).toEqual([]);
  });
});

describe("updateLiveBand", () => {
  it("isHeadliner 토글", async () => {
    const live = await createLive();
    const band = await createBand();
    await addLiveBand({ liveId: live.id, bandId: band.id });

    const updated = await updateLiveBand(live.id, band.id, {
      isHeadliner: true,
    });
    expect(updated.isHeadliner).toBe(true);
  });

  it("order 변경", async () => {
    const live = await createLive();
    const band = await createBand();
    await addLiveBand({ liveId: live.id, bandId: band.id, order: 0 });

    const updated = await updateLiveBand(live.id, band.id, { order: 5 });
    expect(updated.order).toBe(5);
  });

  it("존재하지 않는 (liveId, bandId) → throw", async () => {
    await expect(
      updateLiveBand(99999, 99999, { order: 1 })
    ).rejects.toThrow(/찾을 수 없/);
  });
});

describe("removeLiveBand", () => {
  it("정상 제거", async () => {
    const live = await createLive();
    const band = await createBand();
    await addLiveBand({ liveId: live.id, bandId: band.id });

    await removeLiveBand(live.id, band.id);
    expect(await listLiveBands(live.id)).toEqual([]);
  });

  it("존재하지 않는 row 제거도 throw 하지 않는다 (멱등)", async () => {
    const live = await createLive();
    await expect(removeLiveBand(live.id, 99999)).resolves.toBeUndefined();
  });

  it("두 번 호출해도 동일 결과 (멱등)", async () => {
    const live = await createLive();
    const band = await createBand();
    await addLiveBand({ liveId: live.id, bandId: band.id });

    await removeLiveBand(live.id, band.id);
    await removeLiveBand(live.id, band.id);
    expect(await listLiveBands(live.id)).toEqual([]);
  });
});

describe("reorderLiveBands", () => {
  it("순서 재할당", async () => {
    const live = await createLive();
    const b1 = await createBand({ slug: "reorder-b-1" });
    const b2 = await createBand({ slug: "reorder-b-2" });
    const b3 = await createBand({ slug: "reorder-b-3" });
    await addLiveBand({ liveId: live.id, bandId: b1.id, order: 0 });
    await addLiveBand({ liveId: live.id, bandId: b2.id, order: 1 });
    await addLiveBand({ liveId: live.id, bandId: b3.id, order: 2 });

    await reorderLiveBands(live.id, [b3.id, b1.id, b2.id]);

    const result = await listLiveBands(live.id);
    expect(result.map((r) => r.bandId)).toEqual([b3.id, b1.id, b2.id]);
    expect(result.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it("다른 라이브의 bandId 포함 → throw, 트랜잭션 롤백 (기존 order 유지)", async () => {
    const liveA = await createLive({ slug: "ra-a" });
    const liveB = await createLive({ slug: "ra-b" });
    const b1 = await createBand({ slug: "reord-x-1" });
    const b2 = await createBand({ slug: "reord-x-2" });
    await addLiveBand({ liveId: liveA.id, bandId: b1.id, order: 0 });
    await addLiveBand({ liveId: liveB.id, bandId: b2.id, order: 0 });

    await expect(
      reorderLiveBands(liveA.id, [b1.id, b2.id])
    ).rejects.toThrow();

    // liveA 의 b1 order 는 그대로 0
    const row = await testDb.liveBand.findUnique({
      where: { liveId_bandId: { liveId: liveA.id, bandId: b1.id } },
    });
    expect(row?.order).toBe(0);
  });

  it("빈 배열 → throw", async () => {
    const live = await createLive();
    await expect(reorderLiveBands(live.id, [])).rejects.toThrow();
  });
});
