/**
 * `/admin/lives/[id]/live-band-actions.ts` 통합 테스트.
 *
 * 검증 대상 (모든 action):
 *  - searchBandsAction
 *  - addLiveBandAction
 *  - updateLiveBandAction
 *  - reorderLiveBandsAction
 *  - removeLiveBandAction
 *
 * 케이스: 인증 / liveId 검증 / live 미존재 / live soft-deleted / bandId 검증 / 중복 /
 *        다른 라이브 밴드 정렬(보안) / 빈 정렬 / 멱등 / revalidatePath / 검색 매칭/상한.
 */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createBand, createWork } from "@/test/factories/band";
import {
  cookieMocks,
  redirectMock,
  revalidatePathMock,
  mockAdminSession,
  mockNoSession,
  resetAdminSessionMocks,
  TEST_JWT_SECRET,
} from "@/test/helpers/admin-session";

vi.mock("next/headers", () => ({
  cookies: async () => cookieMocks.api,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: vi.fn(),
}));

beforeEach(async () => {
  resetAdminSessionMocks();
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
  await resetDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(async () => {
  await disconnectDb();
});

async function importActions() {
  return await import("./live-band-actions");
}

// =====================================================================
// searchBandsAction
// =====================================================================

describe("searchBandsAction", () => {
  it("세션 없으면 /admin/login 으로 redirect", async () => {
    mockNoSession();
    const { searchBandsAction } = await importActions();
    await expect(searchBandsAction("mygo")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  describe("with session", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("빈 문자열 query → { ok: true, bands: [] }", async () => {
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("");
      expect(result).toEqual({ ok: true, bands: [] });
    });

    it("공백만 있는 query → { ok: true, bands: [] }", async () => {
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("   ");
      expect(result).toEqual({ ok: true, bands: [] });
    });

    it("nameKo 매칭", async () => {
      await createBand({ nameKo: "마이고", nameJp: "MyGO!!!!!", slug: "mygo-ko" });
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("마이");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.bands.some((b) => b.nameKo === "마이고")).toBe(true);
      }
    });

    it("nameJp 매칭", async () => {
      await createBand({
        nameKo: "마이고",
        nameJp: "MyGO!!!!!",
        slug: "mygo-jp",
      });
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("MyGO");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.bands.some((b) => b.nameJp === "MyGO!!!!!")).toBe(true);
      }
    });

    it("nameEn 매칭 (대소문자 무시)", async () => {
      await createBand({
        nameKo: "에이브뮤지카",
        nameJp: "アヴェ・ミュージカ",
        nameEn: "Ave Mujica",
        slug: "ave-mujica",
      });
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("ave");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.bands.some((b) => b.nameEn === "Ave Mujica")).toBe(true);
      }
    });

    it("slug 매칭", async () => {
      await createBand({
        nameKo: "토게토게",
        nameJp: "トゲナシトゲアリ",
        slug: "togenashi",
      });
      const { searchBandsAction } = await importActions();
      const result = await searchBandsAction("toge");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.bands.some((b) => b.slug === "togenashi")).toBe(true);
      }
    });

    it("100자 초과 query 도 거부하지 않고 잘라서 처리 (보호용 cap)", async () => {
      const { searchBandsAction } = await importActions();
      const longQuery = "a".repeat(500);
      const result = await searchBandsAction(longQuery);
      expect(result.ok).toBe(true);
    });
  });
});

// =====================================================================
// addLiveBandAction
// =====================================================================

describe("addLiveBandAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { addLiveBandAction } = await importActions();
    await expect(addLiveBandAction(1, 1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  describe("with session", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("정상: live + band 추가 → liveBand row 생성", async () => {
      const live = await createLive();
      const band = await createBand();
      const { addLiveBandAction } = await importActions();

      const result = await addLiveBandAction(live.id, band.id);
      expect(result).toEqual({ ok: true });

      const rows = await testDb.liveBand.findMany({
        where: { liveId: live.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].bandId).toBe(band.id);
      expect(rows[0].isHeadliner).toBe(false);
      expect(rows[0].order).toBe(0);
    });

    it("isHeadliner=true 전달 → row 에 반영", async () => {
      const live = await createLive();
      const band = await createBand();
      const { addLiveBandAction } = await importActions();

      const result = await addLiveBandAction(live.id, band.id, {
        isHeadliner: true,
      });
      expect(result).toEqual({ ok: true });

      const row = await testDb.liveBand.findUnique({
        where: { liveId_bandId: { liveId: live.id, bandId: band.id } },
      });
      expect(row?.isHeadliner).toBe(true);
    });

    it("order 기본값 = 현재 라인업 길이 (말단 append)", async () => {
      const live = await createLive();
      const work = await createWork({ slug: "w-add-order" });
      const band1 = await createBand({ workId: work.id, slug: "b-1" });
      const band2 = await createBand({ workId: work.id, slug: "b-2" });
      const { addLiveBandAction } = await importActions();

      await addLiveBandAction(live.id, band1.id);
      await addLiveBandAction(live.id, band2.id);

      const rows = await testDb.liveBand.findMany({
        where: { liveId: live.id },
        orderBy: { order: "asc" },
      });
      expect(rows[0].bandId).toBe(band1.id);
      expect(rows[0].order).toBe(0);
      expect(rows[1].bandId).toBe(band2.id);
      expect(rows[1].order).toBe(1);
    });

    it.each([0, -1, 1.5, Number.NaN])(
      "invalid liveId (%s) → { ok: false, error }",
      async (badId) => {
        const band = await createBand();
        const { addLiveBandAction } = await importActions();
        const result = await addLiveBandAction(badId as number, band.id);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeTruthy();
        }
      }
    );

    it.each([0, -5])(
      "invalid bandId (%s) → { ok: false, error }",
      async (badId) => {
        const live = await createLive();
        const { addLiveBandAction } = await importActions();
        const result = await addLiveBandAction(live.id, badId as number);
        expect(result.ok).toBe(false);
      }
    );

    it("live 존재하지 않음 → { ok: false, error }", async () => {
      const band = await createBand();
      const { addLiveBandAction } = await importActions();
      const result = await addLiveBandAction(999999, band.id);
      expect(result.ok).toBe(false);
    });

    it("live soft-deleted → { ok: false, error }", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.live.update({
        where: { id: live.id },
        data: { deletedAt: new Date() },
      });
      const { addLiveBandAction } = await importActions();
      const result = await addLiveBandAction(live.id, band.id);
      expect(result.ok).toBe(false);
    });

    it("band 존재하지 않음 → { ok: false, error }", async () => {
      const live = await createLive();
      const { addLiveBandAction } = await importActions();
      const result = await addLiveBandAction(live.id, 999999);
      expect(result.ok).toBe(false);
    });

    it("같은 (liveId, bandId) 중복 추가 → { ok: false, error } 한국어 메시지", async () => {
      const live = await createLive();
      const band = await createBand();
      const { addLiveBandAction } = await importActions();

      const first = await addLiveBandAction(live.id, band.id);
      expect(first.ok).toBe(true);

      const second = await addLiveBandAction(live.id, band.id);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error).toMatch(/이미 추가/);
      }
    });

    it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
      const live = await createLive();
      const band = await createBand();
      const { addLiveBandAction } = await importActions();

      await addLiveBandAction(live.id, band.id);
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });
  });
});

// =====================================================================
// updateLiveBandAction
// =====================================================================

describe("updateLiveBandAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { updateLiveBandAction } = await importActions();
    await expect(
      updateLiveBandAction(1, 1, { isHeadliner: true })
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  describe("with session", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("isHeadliner 패치 적용", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });
      const { updateLiveBandAction } = await importActions();

      const result = await updateLiveBandAction(live.id, band.id, {
        isHeadliner: true,
      });
      expect(result).toEqual({ ok: true });

      const row = await testDb.liveBand.findUnique({
        where: { liveId_bandId: { liveId: live.id, bandId: band.id } },
      });
      expect(row?.isHeadliner).toBe(true);
    });

    it("order 패치 적용", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });
      const { updateLiveBandAction } = await importActions();

      const result = await updateLiveBandAction(live.id, band.id, {
        order: 3,
      });
      expect(result).toEqual({ ok: true });

      const row = await testDb.liveBand.findUnique({
        where: { liveId_bandId: { liveId: live.id, bandId: band.id } },
      });
      expect(row?.order).toBe(3);
    });

    it("invalid liveId (0) → { ok: false }", async () => {
      const { updateLiveBandAction } = await importActions();
      const result = await updateLiveBandAction(0, 1, { isHeadliner: true });
      expect(result.ok).toBe(false);
    });

    it("invalid bandId (음수) → { ok: false }", async () => {
      const live = await createLive();
      const { updateLiveBandAction } = await importActions();
      const result = await updateLiveBandAction(live.id, -1, {
        isHeadliner: true,
      });
      expect(result.ok).toBe(false);
    });

    it("live 미존재 → { ok: false }", async () => {
      const { updateLiveBandAction } = await importActions();
      const result = await updateLiveBandAction(999999, 1, {
        isHeadliner: true,
      });
      expect(result.ok).toBe(false);
    });

    it("live soft-deleted → { ok: false }", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });
      await testDb.live.update({
        where: { id: live.id },
        data: { deletedAt: new Date() },
      });
      const { updateLiveBandAction } = await importActions();
      const result = await updateLiveBandAction(live.id, band.id, {
        isHeadliner: true,
      });
      expect(result.ok).toBe(false);
    });

    it("liveBand row 없음 → { ok: false }", async () => {
      const live = await createLive();
      const band = await createBand();
      const { updateLiveBandAction } = await importActions();
      const result = await updateLiveBandAction(live.id, band.id, {
        isHeadliner: true,
      });
      expect(result.ok).toBe(false);
    });

    it("성공 시 revalidatePath", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });
      const { updateLiveBandAction } = await importActions();
      await updateLiveBandAction(live.id, band.id, { isHeadliner: true });
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });
  });
});

// =====================================================================
// reorderLiveBandsAction
// =====================================================================

describe("reorderLiveBandsAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { reorderLiveBandsAction } = await importActions();
    await expect(reorderLiveBandsAction(1, [1, 2])).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  describe("with session", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("정렬된 bandIds 순서대로 order 갱신", async () => {
      const live = await createLive();
      const work = await createWork({ slug: "w-reorder" });
      const b1 = await createBand({ workId: work.id, slug: "b-r-1" });
      const b2 = await createBand({ workId: work.id, slug: "b-r-2" });
      const b3 = await createBand({ workId: work.id, slug: "b-r-3" });

      await testDb.liveBand.createMany({
        data: [
          { liveId: live.id, bandId: b1.id, order: 0 },
          { liveId: live.id, bandId: b2.id, order: 1 },
          { liveId: live.id, bandId: b3.id, order: 2 },
        ],
      });

      const { reorderLiveBandsAction } = await importActions();
      const result = await reorderLiveBandsAction(live.id, [
        b3.id,
        b1.id,
        b2.id,
      ]);
      expect(result).toEqual({ ok: true });

      const rows = await testDb.liveBand.findMany({
        where: { liveId: live.id },
        orderBy: { order: "asc" },
      });
      expect(rows.map((r) => r.bandId)).toEqual([b3.id, b1.id, b2.id]);
    });

    it("빈 배열 → { ok: false }", async () => {
      const live = await createLive();
      const { reorderLiveBandsAction } = await importActions();
      const result = await reorderLiveBandsAction(live.id, []);
      expect(result.ok).toBe(false);
    });

    it("invalid liveId → { ok: false }", async () => {
      const { reorderLiveBandsAction } = await importActions();
      const result = await reorderLiveBandsAction(0, [1]);
      expect(result.ok).toBe(false);
    });

    it("live 미존재 → { ok: false }", async () => {
      const { reorderLiveBandsAction } = await importActions();
      const result = await reorderLiveBandsAction(999999, [1]);
      expect(result.ok).toBe(false);
    });

    it("다른 live 의 band 가 섞이면 → { ok: false } (security)", async () => {
      const liveA = await createLive();
      const liveB = await createLive({ slug: "other-live" });
      const work = await createWork({ slug: "w-sec" });
      const bandA = await createBand({ workId: work.id, slug: "b-sec-a" });
      const bandB = await createBand({ workId: work.id, slug: "b-sec-b" });

      await testDb.liveBand.create({
        data: { liveId: liveA.id, bandId: bandA.id, order: 0 },
      });
      await testDb.liveBand.create({
        data: { liveId: liveB.id, bandId: bandB.id, order: 0 },
      });

      const { reorderLiveBandsAction } = await importActions();
      // liveA 정렬 호출에 liveB 의 bandB 를 끼워넣음.
      const result = await reorderLiveBandsAction(liveA.id, [
        bandA.id,
        bandB.id,
      ]);
      expect(result.ok).toBe(false);

      // liveA 의 라인업이 변하지 않아야 함.
      const rowsA = await testDb.liveBand.findMany({
        where: { liveId: liveA.id },
      });
      expect(rowsA).toHaveLength(1);
      expect(rowsA[0].bandId).toBe(bandA.id);
    });

    it("성공 시 revalidatePath", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });

      const { reorderLiveBandsAction } = await importActions();
      await reorderLiveBandsAction(live.id, [band.id]);
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });
  });
});

// =====================================================================
// removeLiveBandAction
// =====================================================================

describe("removeLiveBandAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { removeLiveBandAction } = await importActions();
    await expect(removeLiveBandAction(1, 1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  describe("with session", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("정상: 라인업에서 제거", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });

      const { removeLiveBandAction } = await importActions();
      const result = await removeLiveBandAction(live.id, band.id);
      expect(result).toEqual({ ok: true });

      const rows = await testDb.liveBand.findMany({
        where: { liveId: live.id },
      });
      expect(rows).toEqual([]);
    });

    it("멱등: 존재하지 않는 row 제거도 { ok: true }", async () => {
      const live = await createLive();
      const band = await createBand();

      const { removeLiveBandAction } = await importActions();
      const first = await removeLiveBandAction(live.id, band.id);
      const second = await removeLiveBandAction(live.id, band.id);
      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true });
    });

    it("invalid liveId → { ok: false }", async () => {
      const { removeLiveBandAction } = await importActions();
      const result = await removeLiveBandAction(-1, 1);
      expect(result.ok).toBe(false);
    });

    it("invalid bandId → { ok: false }", async () => {
      const live = await createLive();
      const { removeLiveBandAction } = await importActions();
      const result = await removeLiveBandAction(live.id, 0);
      expect(result.ok).toBe(false);
    });

    it("live 미존재 → { ok: false }", async () => {
      const { removeLiveBandAction } = await importActions();
      const result = await removeLiveBandAction(999999, 1);
      expect(result.ok).toBe(false);
    });

    it("live soft-deleted → { ok: false }", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });
      await testDb.live.update({
        where: { id: live.id },
        data: { deletedAt: new Date() },
      });
      const { removeLiveBandAction } = await importActions();
      const result = await removeLiveBandAction(live.id, band.id);
      expect(result.ok).toBe(false);
    });

    it("성공 시 revalidatePath", async () => {
      const live = await createLive();
      const band = await createBand();
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 0 },
      });

      const { removeLiveBandAction } = await importActions();
      await removeLiveBandAction(live.id, band.id);
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });
  });
});
