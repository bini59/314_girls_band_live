/**
 * `/admin/lives/[id]/ticket-sale-actions.ts` 통합 테스트.
 *
 * 검증 대상:
 *  - createTicketSaleAction
 *  - updateTicketSaleAction
 *  - setTicketSaleTiersAction
 *  - deleteTicketSaleAction
 *
 * 공통 룰:
 *  - 인증 필수: 세션 없으면 redirect.
 *  - 성공: { ok: true, sale? }
 *  - 검증 실패: { ok: false, fieldErrors }
 *  - 도메인 에러: { ok: false, error }
 *  - 모든 mutation 후 revalidatePath("/admin/lives") 호출.
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
  createTicketSaleRow,
  linkTicketSaleTier,
} from "@/test/factories/ticket-sale";
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
  return await import("./ticket-sale-actions");
}

// ---------------------------------------------------------------------------
// createTicketSaleAction
// ---------------------------------------------------------------------------

describe("createTicketSaleAction — 인증", () => {
  it("세션 없으면 /admin/login 으로 redirect", async () => {
    mockNoSession();
    const { createTicketSaleAction } = await importActions();
    await expect(
      createTicketSaleAction(1, {
        vendorId: 1,
        type: "FC_SENKO",
        method: "LOTTERY",
        startsAtJst: "2026-01-10T12:00",
      })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });
});

describe("createTicketSaleAction — 정상 흐름", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("happy: tier 없이도 라운드 생성 + 직렬화 sale 반환", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      label: "FC 最速先行",
      startsAtJst: "2026-01-10T12:00",
      endsAtJst: "2026-01-15T23:59",
      tierIds: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale).toBeDefined();
    expect(result.sale!.type).toBe("FC_SENKO");
    expect(result.sale!.method).toBe("LOTTERY");
    expect(result.sale!.label).toBe("FC 最速先行");
    // JST 12:00 = UTC 03:00
    expect(result.sale!.startsAt).toBe("2026-01-10T03:00:00.000Z");
    expect(result.sale!.endsAt).toBe("2026-01-15T14:59:00.000Z");
    expect(result.sale!.tiers).toEqual([]);
    expect(result.sale!.vendor.id).toBe(vendor.id);

    const dbRows = await testDb.ticketSale.findMany({
      where: { liveId: live.id },
    });
    expect(dbRows.length).toBe(1);
  });

  it("happy: 본 라이브 format 에 속한 tier 들과 함께 생성 + 링크 형성", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const t2 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "IPPAN",
      method: "FIRST_COME",
      startsAtJst: "2026-02-01T10:00",
      tierIds: [t1.id, t2.id],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale!.tiers.map((t) => t.id).sort()).toEqual(
      [t1.id, t2.id].sort()
    );

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: result.sale!.id },
    });
    expect(links.length).toBe(2);
  });

  it("성공 시 revalidatePath('/admin/lives') 호출", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const { createTicketSaleAction } = await importActions();
    await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

describe("createTicketSaleAction — 검증/보안", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("타 라이브의 tier 포함 → fieldErrors.tierIds + TicketSale row 없음 (rollback)", async () => {
    const liveA = await createLive({ slug: "act-create-a" });
    const liveB = await createLive({ slug: "act-create-b" });
    const fmtB = await createLiveFormatRow(liveB.id);
    const foreignTier = await createTicketTierRow(fmtB.id);
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(liveA.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
      tierIds: [foreignTier.id],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("tierIds");

    // rollback 확인: liveA 에 TicketSale row 가 남지 않는다.
    const rows = await testDb.ticketSale.findMany({
      where: { liveId: liveA.id },
    });
    expect(rows).toEqual([]);
  });

  it("존재하지 않는 vendor → fieldErrors.vendorId (FK)", async () => {
    const live = await createLive();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: 999999,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("vendorId");
  });

  it("형식 오류 (공백 datetime) → fieldErrors.startsAtJst", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10 12:00", // 공백
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("startsAtJst");
  });

  it("endsAt <= startsAt → fieldErrors.endsAtJst", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
      endsAtJst: "2026-01-10T11:00",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("endsAtJst");
  });

  it("announceAt < endsAt → fieldErrors.announceAtJst", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
      endsAtJst: "2026-01-15T23:59",
      announceAtJst: "2026-01-14T10:00",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("announceAtJst");
  });

  it("paymentDeadlineAt < announceAt → fieldErrors.paymentDeadlineAtJst", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
      endsAtJst: "2026-01-15T23:59",
      announceAtJst: "2026-01-20T10:00",
      paymentDeadlineAtJst: "2026-01-18T23:59",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("paymentDeadlineAtJst");
  });

  it("유효하지 않은 liveId → { ok: false, error }", async () => {
    const vendor = await createVendorRow();
    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(0, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("soft-deleted 라이브 → { ok: false, error }", async () => {
    const live = await createLive();
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });
    const vendor = await createVendorRow();

    const { createTicketSaleAction } = await importActions();
    const result = await createTicketSaleAction(live.id, {
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAtJst: "2026-01-10T12:00",
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateTicketSaleAction
// ---------------------------------------------------------------------------

describe("updateTicketSaleAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { updateTicketSaleAction } = await importActions();
    await expect(
      updateTicketSaleAction(1, { label: "x" })
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("happy: label / method 부분 수정 + tier 링크는 보존", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, tier.id);

    const { updateTicketSaleAction } = await importActions();
    const result = await updateTicketSaleAction(sale.id, {
      label: "수정된 라벨",
      method: "FIRST_COME",
    });

    expect(result.ok).toBe(true);
    const reloaded = await testDb.ticketSale.findUnique({
      where: { id: sale.id },
    });
    expect(reloaded!.label).toBe("수정된 라벨");
    expect(reloaded!.method).toBe("FIRST_COME");

    // tier 링크 보존
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.length).toBe(1);
  });

  it("tierIds 가 patch 에 포함되어 있어도 update 가 tier 링크를 건드리지 않음", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const t2 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, t1.id);

    const { updateTicketSaleAction } = await importActions();
    // patch 에 tierIds 가 들어와도 무시되어야 함.
    const result = await updateTicketSaleAction(sale.id, {
      label: "변경",
      tierIds: [t2.id], // 무시
    });
    expect(result.ok).toBe(true);

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.map((l) => l.tierId)).toEqual([t1.id]);
  });

  it("존재하지 않는 saleId → { ok: false, error }", async () => {
    const { updateTicketSaleAction } = await importActions();
    const result = await updateTicketSaleAction(999999, { label: "x" });
    expect(result.ok).toBe(false);
  });

  it("soft-deleted 라이브에 속한 sale 수정 거부", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { updateTicketSaleAction } = await importActions();
    const result = await updateTicketSaleAction(sale.id, { label: "x" });
    expect(result.ok).toBe(false);
  });

  it("형식 오류 datetime → fieldErrors", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    const { updateTicketSaleAction } = await importActions();
    const result = await updateTicketSaleAction(sale.id, {
      startsAtJst: "잘못된 형식",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("startsAtJst");
  });

  it("성공 시 revalidatePath 호출", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    const { updateTicketSaleAction } = await importActions();
    await updateTicketSaleAction(sale.id, { label: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

// ---------------------------------------------------------------------------
// setTicketSaleTiersAction
// ---------------------------------------------------------------------------

describe("setTicketSaleTiersAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { setTicketSaleTiersAction } = await importActions();
    await expect(setTicketSaleTiersAction(1, [])).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("happy: 본 라이브의 tier 들로 교체", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const t2 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, t1.id);

    const { setTicketSaleTiersAction } = await importActions();
    const result = await setTicketSaleTiersAction(sale.id, [t2.id]);

    expect(result.ok).toBe(true);
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.map((l) => l.tierId)).toEqual([t2.id]);
  });

  it("타 라이브 tier 포함 → fieldErrors.tierIds + 기존 링크 유지 (rollback)", async () => {
    const liveA = await createLive({ slug: "stt-a" });
    const liveB = await createLive({ slug: "stt-b" });
    const fmtA = await createLiveFormatRow(liveA.id);
    const fmtB = await createLiveFormatRow(liveB.id);
    const tA = await createTicketTierRow(fmtA.id);
    const tB = await createTicketTierRow(fmtB.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(liveA.id, vendor.id);
    await linkTicketSaleTier(sale.id, tA.id);

    const { setTicketSaleTiersAction } = await importActions();
    const result = await setTicketSaleTiersAction(sale.id, [tA.id, tB.id]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("tierIds");

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.map((l) => l.tierId)).toEqual([tA.id]);
  });

  it("빈 배열 → 모든 링크 제거", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, t1.id);

    const { setTicketSaleTiersAction } = await importActions();
    const result = await setTicketSaleTiersAction(sale.id, []);
    expect(result.ok).toBe(true);

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links).toEqual([]);
  });

  it("존재하지 않는 saleId → { ok: false, error }", async () => {
    const { setTicketSaleTiersAction } = await importActions();
    const result = await setTicketSaleTiersAction(999999, []);
    expect(result.ok).toBe(false);
  });

  it("soft-deleted 라이브의 sale → { ok: false, error }", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { setTicketSaleTiersAction } = await importActions();
    const result = await setTicketSaleTiersAction(sale.id, []);
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    const { setTicketSaleTiersAction } = await importActions();
    await setTicketSaleTiersAction(sale.id, []);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

// ---------------------------------------------------------------------------
// deleteTicketSaleAction
// ---------------------------------------------------------------------------

describe("deleteTicketSaleAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { deleteTicketSaleAction } = await importActions();
    await expect(deleteTicketSaleAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("happy: 삭제 + TicketSaleTier cascade", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, tier.id);

    const { deleteTicketSaleAction } = await importActions();
    const result = await deleteTicketSaleAction(sale.id);
    expect(result.ok).toBe(true);

    const row = await testDb.ticketSale.findUnique({
      where: { id: sale.id },
    });
    expect(row).toBeNull();
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links).toEqual([]);
  });

  it("존재하지 않는 saleId → { ok: false, error }", async () => {
    const { deleteTicketSaleAction } = await importActions();
    const result = await deleteTicketSaleAction(999999);
    expect(result.ok).toBe(false);
  });

  it("두 번째 호출은 not-found → { ok: false, error } (idempotent 보장 안 함)", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    const { deleteTicketSaleAction } = await importActions();
    const first = await deleteTicketSaleAction(sale.id);
    expect(first.ok).toBe(true);

    const second = await deleteTicketSaleAction(sale.id);
    expect(second.ok).toBe(false);
  });

  it("soft-deleted 라이브 sale → { ok: false, error }", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { deleteTicketSaleAction } = await importActions();
    const result = await deleteTicketSaleAction(sale.id);
    expect(result.ok).toBe(false);
  });

  it("유효하지 않은 saleId → { ok: false, error }", async () => {
    const { deleteTicketSaleAction } = await importActions();
    const result = await deleteTicketSaleAction(0);
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    const { deleteTicketSaleAction } = await importActions();
    await deleteTicketSaleAction(sale.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});
