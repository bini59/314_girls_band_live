/**
 * TicketTier 레포지토리 통합 테스트.
 *
 *  - list/create/update/delete + cascade.
 *  - reorder cross-format/cross-live 가드 + 트랜잭션 롤백.
 *  - getTierLiveId 정확성.
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
  listTicketTiers,
  createTicketTier,
  updateTicketTier,
  deleteTicketTier,
  reorderTicketTiers,
  getTierLiveId,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listTicketTiers", () => {
  it("빈 포맷 → []", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    expect(await listTicketTiers(fmt.id)).toEqual([]);
  });

  it("order asc, id asc 정렬", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id, { name: "A", order: 1 });
    const t2 = await createTicketTierRow(fmt.id, { name: "B", order: 0 });
    const t3 = await createTicketTierRow(fmt.id, { name: "C", order: 1 });

    const result = await listTicketTiers(fmt.id);
    expect(result.map((t) => t.id)).toEqual([t2.id, t1.id, t3.id]);
  });
});

describe("createTicketTier", () => {
  it("정상 생성", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);

    const tier = await createTicketTier({
      formatId: fmt.id,
      name: "S席",
      priceJpy: 9800,
    });
    expect(tier.name).toBe("S席");
    expect(tier.priceJpy).toBe(9800);
    expect(tier.order).toBe(0);
  });

  it("order / notes 전달", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);

    const tier = await createTicketTier({
      formatId: fmt.id,
      name: "VIP",
      priceJpy: 25000,
      order: 5,
      notes: "특전 포함",
    });
    expect(tier.order).toBe(5);
    expect(tier.notes).toBe("특전 포함");
  });
});

describe("updateTicketTier", () => {
  it("부분 패치", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);

    const updated = await updateTicketTier(tier.id, { priceJpy: 12000 });
    expect(updated.priceJpy).toBe(12000);
    expect(updated.name).toBe(tier.name);
  });

  it("존재하지 않는 tierId → throw", async () => {
    await expect(updateTicketTier(999999, { name: "x" })).rejects.toThrow(
      /찾을 수 없/
    );
  });
});

describe("deleteTicketTier", () => {
  it("정상 삭제", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);

    await deleteTicketTier(tier.id);
    expect(await listTicketTiers(fmt.id)).toEqual([]);
  });

  it("TicketSaleTier cascade", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);
    const vendor = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, vendor.id);
    await linkTicketSaleTier(sale.id, tier.id);

    await deleteTicketTier(tier.id);

    const links = await testDb.ticketSaleTier.findMany({
      where: { tierId: tier.id },
    });
    expect(links).toEqual([]);
  });

  it("존재하지 않는 tierId → throw", async () => {
    await expect(deleteTicketTier(999999)).rejects.toThrow(/찾을 수 없/);
  });
});

describe("reorderTicketTiers", () => {
  it("순서 재할당", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id, { name: "A", order: 0 });
    const t2 = await createTicketTierRow(fmt.id, { name: "B", order: 1 });
    const t3 = await createTicketTierRow(fmt.id, { name: "C", order: 2 });

    await reorderTicketTiers(fmt.id, [t3.id, t1.id, t2.id]);

    const result = await listTicketTiers(fmt.id);
    expect(result.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id]);
    expect(result.map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it("다른 format 의 tierId 포함 → throw, 롤백", async () => {
    const live = await createLive();
    const fmtA = await createLiveFormatRow(live.id);
    const fmtB = await createLiveFormatRow(live.id, { type: "STREAMING" });
    const tA = await createTicketTierRow(fmtA.id, { name: "A", order: 0 });
    const tB = await createTicketTierRow(fmtB.id, { name: "B", order: 0 });

    await expect(
      reorderTicketTiers(fmtA.id, [tA.id, tB.id])
    ).rejects.toThrow();

    // tA.order 는 그대로 0
    const row = await testDb.ticketTier.findUnique({ where: { id: tA.id } });
    expect(row?.order).toBe(0);
  });

  it("빈 배열 → throw", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    await expect(reorderTicketTiers(fmt.id, [])).rejects.toThrow();
  });
});

describe("getTierLiveId", () => {
  it("tier → format → liveId 정확 반환", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);

    expect(await getTierLiveId(tier.id)).toBe(live.id);
  });

  it("존재하지 않는 tierId → null", async () => {
    expect(await getTierLiveId(999999)).toBeNull();
  });
});
