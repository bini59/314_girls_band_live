/**
 * `/admin/lives/[id]/ticket-tier-actions.ts` 통합 테스트.
 *
 * 검증 대상:
 *  - createTicketTierAction(formatId, input)
 *  - updateTicketTierAction(tierId, patch)
 *  - deleteTicketTierAction(tierId)
 *  - reorderTicketTiersAction(formatId, orderedTierIds)
 *
 * 공통:
 *  - 모든 mutation 후 revalidatePath 호출 (live 경로 포함).
 *  - 인증 실패 시 redirect (NEXT_REDIRECT).
 *  - soft-deleted 라이브 산하 mutation 은 거부.
 *  - 응답 shape: { ok: true, tier?, savedAt? } | { ok: false, error?, fieldErrors? }.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createLiveFormatRow } from "@/test/factories/live-format";
import { createTicketTierRow } from "@/test/factories/ticket-tier";
import { createVendorRow } from "@/test/factories/vendor";
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
  return await import("./ticket-tier-actions");
}

/** 라이브 + 포맷을 한 번에 생성하는 헬퍼. */
async function setupLiveFormat() {
  const live = await createLive();
  const format = await createLiveFormatRow(live.id);
  return { live, format };
}

// ----- createTicketTierAction -------------------------------------------------

describe("createTicketTierAction — 인증", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { createTicketTierAction } = await importActions();
    await expect(
      createTicketTierAction(1, { name: "S", priceJpy: 1000 })
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("createTicketTierAction — 정상", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("정상 입력 → tier row 생성 + DTO 반환", async () => {
    const { format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();

    const result = await createTicketTierAction(format.id, {
      name: "S석 지정",
      priceJpy: 9800,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.tier).toMatchObject({
      name: "S석 지정",
      priceJpy: 9800,
      order: 0,
      notes: null,
    });

    const rows = await testDb.ticketTier.findMany({
      where: { formatId: format.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("notes 빈 문자열 → null 로 저장", async () => {
    const { format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();

    const result = await createTicketTierAction(format.id, {
      name: "A",
      priceJpy: 5000,
      notes: "",
    });

    expect(result.ok).toBe(true);
    const rows = await testDb.ticketTier.findMany({
      where: { formatId: format.id },
    });
    expect(rows[0].notes).toBeNull();
  });

  it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
    const { live, format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();
    await createTicketTierAction(format.id, { name: "A", priceJpy: 100 });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/lives/${live.id}`);
  });
});

describe("createTicketTierAction — 검증", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("name 이 빈 문자열 → fieldErrors.name", async () => {
    const { format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();

    const result = await createTicketTierAction(format.id, {
      name: "",
      priceJpy: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("name 100자 초과 → fieldErrors.name", async () => {
    const { format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();
    const long = "あ".repeat(101);

    const result = await createTicketTierAction(format.id, {
      name: long,
      priceJpy: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("priceJpy 음수 → fieldErrors.priceJpy", async () => {
    const { format } = await setupLiveFormat();
    const { createTicketTierAction } = await importActions();

    const result = await createTicketTierAction(format.id, {
      name: "S",
      priceJpy: -1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors?.priceJpy).toBeDefined();
  });

  it("formatId 양의 정수 아님 → ok:false (error)", async () => {
    const { createTicketTierAction } = await importActions();
    const result = await createTicketTierAction(0, {
      name: "S",
      priceJpy: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("존재하지 않는 formatId → ok:false", async () => {
    const { createTicketTierAction } = await importActions();
    const result = await createTicketTierAction(999999, {
      name: "S",
      priceJpy: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("soft-deleted 라이브 산하 format → ok:false", async () => {
    const { live, format } = await setupLiveFormat();
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });
    const { createTicketTierAction } = await importActions();
    const result = await createTicketTierAction(format.id, {
      name: "S",
      priceJpy: 100,
    });
    expect(result.ok).toBe(false);
  });
});

// ----- updateTicketTierAction -------------------------------------------------

describe("updateTicketTierAction — 인증", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { updateTicketTierAction } = await importActions();
    await expect(
      updateTicketTierAction(1, { name: "x" })
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("updateTicketTierAction — 정상", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("name 부분 업데이트 → 다른 필드 보존", async () => {
    const { format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id, {
      name: "S",
      priceJpy: 9800,
    });
    const { updateTicketTierAction } = await importActions();

    const result = await updateTicketTierAction(tier.id, { name: "S 변경" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.tier).toMatchObject({ name: "S 변경", priceJpy: 9800 });
    expect(result.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("notes 빈 문자열 → null 저장", async () => {
    const { format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id, { notes: "메모" });
    const { updateTicketTierAction } = await importActions();

    const result = await updateTicketTierAction(tier.id, { notes: "" });

    expect(result.ok).toBe(true);
    const reloaded = await testDb.ticketTier.findUnique({
      where: { id: tier.id },
    });
    expect(reloaded?.notes).toBeNull();
  });

  it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
    const { live, format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id);
    const { updateTicketTierAction } = await importActions();
    await updateTicketTierAction(tier.id, { name: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/lives/${live.id}`);
  });
});

describe("updateTicketTierAction — 거부 케이스", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("name 을 빈 문자열로 patch → fieldErrors.name", async () => {
    const { format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id);
    const { updateTicketTierAction } = await importActions();
    const result = await updateTicketTierAction(tier.id, { name: "" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("priceJpy 음수 patch → fieldErrors.priceJpy", async () => {
    const { format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id);
    const { updateTicketTierAction } = await importActions();
    const result = await updateTicketTierAction(tier.id, { priceJpy: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.fieldErrors?.priceJpy).toBeDefined();
  });

  it("존재하지 않는 tierId → ok:false", async () => {
    const { updateTicketTierAction } = await importActions();
    const result = await updateTicketTierAction(999999, { name: "x" });
    expect(result.ok).toBe(false);
  });

  it("soft-deleted 라이브 산하 tier → ok:false", async () => {
    const { live, format } = await setupLiveFormat();
    const tier = await createTicketTierRow(format.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { updateTicketTierAction } = await importActions();
    const result = await updateTicketTierAction(tier.id, { name: "x" });
    expect(result.ok).toBe(false);
  });
});

// ----- deleteTicketTierAction -------------------------------------------------

describe("deleteTicketTierAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { deleteTicketTierAction } = await importActions();
    await expect(deleteTicketTierAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  describe("정상", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("tier 삭제 → row 제거", async () => {
      const { format } = await setupLiveFormat();
      const tier = await createTicketTierRow(format.id);
      const { deleteTicketTierAction } = await importActions();

      const result = await deleteTicketTierAction(tier.id);
      expect(result.ok).toBe(true);

      const reloaded = await testDb.ticketTier.findUnique({
        where: { id: tier.id },
      });
      expect(reloaded).toBeNull();
    });

    it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
      const { live, format } = await setupLiveFormat();
      const tier = await createTicketTierRow(format.id);
      const { deleteTicketTierAction } = await importActions();
      await deleteTicketTierAction(tier.id);
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });

    it("TicketSaleTier 까지 cascade 삭제", async () => {
      const { live, format } = await setupLiveFormat();
      const tier = await createTicketTierRow(format.id);
      const vendor = await createVendorRow();

      const sale = await testDb.ticketSale.create({
        data: {
          liveId: live.id,
          vendorId: vendor.id,
          type: "IPPAN",
          method: "FIRST_COME",
          startsAt: new Date("2026-03-01T09:00:00Z"),
        },
      });
      await testDb.ticketSaleTier.create({
        data: { saleId: sale.id, tierId: tier.id },
      });

      const { deleteTicketTierAction } = await importActions();
      const result = await deleteTicketTierAction(tier.id);
      expect(result.ok).toBe(true);

      const remaining = await testDb.ticketSaleTier.findMany({
        where: { tierId: tier.id },
      });
      expect(remaining).toEqual([]);
    });

    it("존재하지 않는 tierId → ok:false", async () => {
      const { deleteTicketTierAction } = await importActions();
      const result = await deleteTicketTierAction(999999);
      expect(result.ok).toBe(false);
    });

    it("soft-deleted 라이브 산하 tier → ok:false", async () => {
      const { live, format } = await setupLiveFormat();
      const tier = await createTicketTierRow(format.id);
      await testDb.live.update({
        where: { id: live.id },
        data: { deletedAt: new Date() },
      });
      const { deleteTicketTierAction } = await importActions();
      const result = await deleteTicketTierAction(tier.id);
      expect(result.ok).toBe(false);
    });

    it("ID 가 0 이하 → ok:false", async () => {
      const { deleteTicketTierAction } = await importActions();
      const result = await deleteTicketTierAction(0);
      expect(result.ok).toBe(false);
    });
  });
});

// ----- reorderTicketTiersAction ----------------------------------------------

describe("reorderTicketTiersAction", () => {
  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { reorderTicketTiersAction } = await importActions();
    await expect(
      reorderTicketTiersAction(1, [1, 2])
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  describe("정상", () => {
    beforeEach(async () => {
      await mockAdminSession();
    });

    it("orderedTierIds 순서대로 order 재할당", async () => {
      const { format } = await setupLiveFormat();
      const t1 = await createTicketTierRow(format.id, { order: 0 });
      const t2 = await createTicketTierRow(format.id, { order: 1 });
      const t3 = await createTicketTierRow(format.id, { order: 2 });

      const { reorderTicketTiersAction } = await importActions();
      const result = await reorderTicketTiersAction(format.id, [
        t3.id,
        t1.id,
        t2.id,
      ]);
      expect(result.ok).toBe(true);

      const rows = await testDb.ticketTier.findMany({
        where: { formatId: format.id },
        orderBy: { order: "asc" },
      });
      expect(rows.map((r) => r.id)).toEqual([t3.id, t1.id, t2.id]);
    });

    it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
      const { live, format } = await setupLiveFormat();
      const t1 = await createTicketTierRow(format.id);
      const { reorderTicketTiersAction } = await importActions();
      await reorderTicketTiersAction(format.id, [t1.id]);
      expect(revalidatePathMock).toHaveBeenCalledWith(
        `/admin/lives/${live.id}`
      );
    });

    it("다른 format 의 tier 가 섞이면 → ok:false", async () => {
      const { format: formatA } = await setupLiveFormat();
      const { format: formatB } = await setupLiveFormat();
      const tA = await createTicketTierRow(formatA.id);
      const tB = await createTicketTierRow(formatB.id);

      const { reorderTicketTiersAction } = await importActions();
      const result = await reorderTicketTiersAction(formatA.id, [
        tA.id,
        tB.id,
      ]);
      expect(result.ok).toBe(false);
    });

    it("빈 배열 → ok:false", async () => {
      const { format } = await setupLiveFormat();
      const { reorderTicketTiersAction } = await importActions();
      const result = await reorderTicketTiersAction(format.id, []);
      expect(result.ok).toBe(false);
    });

    it("soft-deleted 라이브 산하 format → ok:false", async () => {
      const { live, format } = await setupLiveFormat();
      const t1 = await createTicketTierRow(format.id);
      await testDb.live.update({
        where: { id: live.id },
        data: { deletedAt: new Date() },
      });
      const { reorderTicketTiersAction } = await importActions();
      const result = await reorderTicketTiersAction(format.id, [t1.id]);
      expect(result.ok).toBe(false);
    });
  });
});
