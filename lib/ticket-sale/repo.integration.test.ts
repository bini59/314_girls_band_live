/**
 * TicketSale 레포지토리 통합 테스트.
 *
 *  - createTicketSale: cross-live tier 검증 + 트랜잭션 atomic.
 *  - listTicketSales: vendor + tiers (flatten) include + 정렬.
 *  - setTicketSaleTiers: cross-live 검증, tierIds [] 허용 (clears all).
 *  - getSaleLiveId 정확성.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

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
  listTicketSales,
  createTicketSale,
  updateTicketSale,
  deleteTicketSale,
  setTicketSaleTiers,
  getSaleLiveId,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("createTicketSale", () => {
  it("tierIds 비어 있어도 생성 가능", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();

    const sale = await createTicketSale({
      liveId: live.id,
      vendorId: vendor.id,
      type: "FC_SENKO",
      method: "LOTTERY",
      startsAt: new Date("2026-01-10T03:00:00Z"),
      tierIds: [],
    });
    expect(sale.id).toBeGreaterThan(0);
    expect(sale.tiers).toEqual([]);
    expect(sale.vendor.id).toBe(vendor.id);
  });

  it("tierIds 가 본 라이브 format 에 속하면 정상 생성 + 링크 형성", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const t2 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();

    const sale = await createTicketSale({
      liveId: live.id,
      vendorId: vendor.id,
      type: "IPPAN",
      method: "FIRST_COME",
      startsAt: new Date("2026-02-01T03:00:00Z"),
      tierIds: [t1.id, t2.id],
    });

    expect(sale.tiers.map((t) => t.id).sort()).toEqual(
      [t1.id, t2.id].sort()
    );

    // DB 에 link 행 존재 확인
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.length).toBe(2);
  });

  it("cross-live tierId 포함 → throw '본 라이브에 속하지 않는 티어' + 트랜잭션 롤백 (TicketSale row 없음)", async () => {
    const liveA = await createLive({ slug: "ts-a" });
    const liveB = await createLive({ slug: "ts-b" });
    const fmtA = await createLiveFormatRow(liveA.id);
    const fmtB = await createLiveFormatRow(liveB.id);
    const tA = await createTicketTierRow(fmtA.id);
    const tB = await createTicketTierRow(fmtB.id);
    const vendor = await createVendorRow();

    await expect(
      createTicketSale({
        liveId: liveA.id,
        vendorId: vendor.id,
        type: "FC_SENKO",
        method: "LOTTERY",
        startsAt: new Date("2026-01-10T03:00:00Z"),
        tierIds: [tA.id, tB.id],
      })
    ).rejects.toThrow(/본 라이브에 속하지 않는 티어/);

    // TicketSale row 가 남지 않음
    const sales = await testDb.ticketSale.findMany({
      where: { liveId: liveA.id },
    });
    expect(sales).toEqual([]);
  });
});

describe("listTicketSales", () => {
  it("빈 라이브 → []", async () => {
    const live = await createLive();
    expect(await listTicketSales(live.id)).toEqual([]);
  });

  it("startsAt asc, id asc 정렬 + vendor + tiers (flatten) include", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();

    const sLater = await createTicketSaleRow(live.id, vendor.id, {
      startsAt: new Date("2026-02-10T03:00:00Z"),
    });
    const sEarlier = await createTicketSaleRow(live.id, vendor.id, {
      startsAt: new Date("2026-01-10T03:00:00Z"),
    });
    await linkTicketSaleTier(sEarlier.id, tier.id);

    const result = await listTicketSales(live.id);
    expect(result.map((s) => s.id)).toEqual([sEarlier.id, sLater.id]);
    expect(result[0]!.vendor.id).toBe(vendor.id);
    expect(result[0]!.tiers.map((t) => t.id)).toEqual([tier.id]);
    expect(result[1]!.tiers).toEqual([]);
  });

  it("다른 라이브의 sale 은 보이지 않는다", async () => {
    const liveA = await createLive({ slug: "ls-a" });
    const liveB = await createLive({ slug: "ls-b" });
    const vendor = await createVendorRow();
    await createTicketSaleRow(liveA.id, vendor.id);

    expect(await listTicketSales(liveB.id)).toEqual([]);
  });
});

describe("updateTicketSale", () => {
  it("부분 패치 — tier 링크는 건드리지 않음", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, tier.id);

    const updated = await updateTicketSale(sale.id, { label: "수정됨" });
    expect(updated.label).toBe("수정됨");

    // tier link 유지
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.length).toBe(1);
  });

  it("존재하지 않는 saleId → throw", async () => {
    await expect(updateTicketSale(999999, { label: "x" })).rejects.toThrow(
      /찾을 수 없/
    );
  });
});

describe("deleteTicketSale", () => {
  it("정상 삭제 + TicketSaleTier cascade", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, tier.id);

    await deleteTicketSale(sale.id);

    expect(
      await testDb.ticketSale.findUnique({ where: { id: sale.id } })
    ).toBeNull();
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links).toEqual([]);
  });

  it("존재하지 않는 saleId → throw", async () => {
    await expect(deleteTicketSale(999999)).rejects.toThrow(/찾을 수 없/);
  });
});

describe("setTicketSaleTiers", () => {
  it("tier 링크를 교체", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const t2 = await createTicketTierRow(fmt.id);
    const t3 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, t1.id);

    await setTicketSaleTiers(sale.id, [t2.id, t3.id]);

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.map((l) => l.tierId).sort()).toEqual([t2.id, t3.id].sort());
  });

  it("tierIds [] 는 모든 링크 제거 (clears all)", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, t1.id);

    await setTicketSaleTiers(sale.id, []);

    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links).toEqual([]);
  });

  it("cross-live tierId → throw + 롤백 (기존 링크 유지)", async () => {
    const liveA = await createLive({ slug: "sst-a" });
    const liveB = await createLive({ slug: "sst-b" });
    const fmtA = await createLiveFormatRow(liveA.id);
    const fmtB = await createLiveFormatRow(liveB.id);
    const tA = await createTicketTierRow(fmtA.id);
    const tB = await createTicketTierRow(fmtB.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(liveA.id, vendor.id);
    await linkTicketSaleTier(sale.id, tA.id);

    await expect(
      setTicketSaleTiers(sale.id, [tA.id, tB.id])
    ).rejects.toThrow();

    // 기존 링크 유지
    const links = await testDb.ticketSaleTier.findMany({
      where: { saleId: sale.id },
    });
    expect(links.map((l) => l.tierId)).toEqual([tA.id]);
  });

  it("존재하지 않는 saleId → throw", async () => {
    await expect(setTicketSaleTiers(999999, [])).rejects.toThrow(
      /찾을 수 없/
    );
  });
});

describe("getSaleLiveId", () => {
  it("sale → liveId 정확 반환", async () => {
    const live = await createLive();
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);

    expect(await getSaleLiveId(sale.id)).toBe(live.id);
  });

  it("존재하지 않는 saleId → null", async () => {
    expect(await getSaleLiveId(999999)).toBeNull();
  });
});
