import { searchBands, searchBandsForAdmin } from "@/lib/band/repo";
import { searchWorks } from "@/lib/works/repo";
import { searchSeries } from "@/lib/series/repo";
import { searchTours } from "@/lib/tours/repo";
import { searchLivesForAdmin } from "@/lib/live/repo";
import { createWorkRow } from "@/test/factories/work";
import { createSeries } from "@/test/factories/series";
import { createTour } from "@/test/factories/tour";
import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { resetDb, testDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createBand } from "@/test/factories/band";
import { createVendorRow } from "@/test/factories/vendor";
import {
  createTicketSale,
  setTicketSaleTiers,
  updateTicketSaleWithTiers,
} from "@/lib/ticket-sale/repo";
import { reorderLiveBands } from "@/lib/live-band/repo";
import { reorderTicketTiers } from "@/lib/ticket-tier/repo";

beforeEach(resetDb);
async function fixture() {
  const live = await createLive();
  const vendor = await createVendorRow();
  const format = await testDb.liveFormat.create({
    data: { liveId: live.id, type: "LIVE_VENUE" },
  });
  const tiers = await Promise.all(
    [0, 1].map((order) =>
      testDb.ticketTier.create({
        data: {
          formatId: format.id,
          name: `tier ${order}`,
          priceJpy: 1000,
          order: order + 10,
        },
      }),
    ),
  );
  const input = {
    liveId: live.id,
    vendorId: vendor.id,
    type: "IPPAN" as const,
    method: "FIRST_COME" as const,
    startsAt: new Date("2026-10-01T09:00:00Z"),
    tierIds: tiers.map((t) => t.id),
  };
  return { live, vendor, format, tiers, input };
}
describe("D1 batch atomicity", () => {
  it("keeps the second sale ID fixed across multiple tier links", async () => {
    const { input } = await fixture();
    const first = await createTicketSale(input);
    const second = await createTicketSale(input);
    for (const sale of [first, second]) {
      expect(sale.tiers.map((tier) => tier.id).sort()).toEqual([...input.tierIds].sort());
      const links = await testDb.ticketSaleTier.findMany({ where: { saleId: sale.id } });
      expect(links.map((link) => link.tierId).sort()).toEqual([...input.tierIds].sort());
    }
    expect(await testDb.ticketSale.count()).toBe(2);
    expect(await testDb.ticketSaleTier.count()).toBe(4);
  });
  it("stores batch-written dates so Prisma date filters find them", async () => {
    const { input } = await fixture();
    const sale = await createTicketSale(input);
    const found = await testDb.ticketSale.findMany({
      where: { startsAt: { gte: new Date("2026-09-30T00:00:00Z") } },
    });
    expect(found.map((s) => s.id)).toEqual([sale.id]);
    expect(found[0].startsAt.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });
  it("rolls back the sale insert when its link statement fails", async () => {
    const { input, tiers } = await fixture();
    await expect(
      createTicketSale({ ...input, tierIds: [tiers[0].id, tiers[0].id] }),
    ).rejects.toThrow();
    expect(await testDb.ticketSale.count()).toBe(0);
    expect(await testDb.ticketSaleTier.count()).toBe(0);
  });
  it.each([false, true])(
    "rolls back link deletion and metadata on link failure (metadata=%s)",
    async (metadata) => {
      const { input, tiers } = await fixture();
      const sale = await createTicketSale({ ...input, label: "original" });
      const ids = [tiers[0].id, tiers[0].id];
      await expect(
        metadata
          ? updateTicketSaleWithTiers(sale.id, { label: "changed" }, ids)
          : setTicketSaleTiers(sale.id, ids),
      ).rejects.toThrow();
      expect(
        (await testDb.ticketSale.findUniqueOrThrow({ where: { id: sale.id } }))
          .label,
      ).toBe("original");
      expect(
        await testDb.ticketSaleTier.count({ where: { saleId: sale.id } }),
      ).toBe(2);
    },
  );
  it("rolls back the first band reorder when the second update fails", async () => {
    const { live } = await fixture();
    const bands = [await createBand(), await createBand()];
    for (const band of bands)
      await testDb.liveBand.create({
        data: { liveId: live.id, bandId: band.id, order: 10 },
      });
    const db = getDb();
    await db
      .prepare(
        `CREATE TRIGGER fail_band BEFORE UPDATE ON live_band WHEN NEW.band_id = ${bands[1].id} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
      )
      .run();
    try {
      await expect(
        reorderLiveBands(
          live.id,
          bands.map((b) => b.id),
        ),
      ).rejects.toThrow(/injected failure/);
      expect((await testDb.liveBand.findMany()).map((b) => b.order)).toEqual([
        10, 10,
      ]);
    } finally {
      await db.prepare("DROP TRIGGER fail_band").run();
    }
  });
  it("rolls back the first tier reorder when the second update fails", async () => {
    const { format, tiers } = await fixture();
    const db = getDb();
    await db
      .prepare(
        `CREATE TRIGGER fail_tier BEFORE UPDATE ON ticket_tier WHEN NEW.id = ${tiers[1].id} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
      )
      .run();
    try {
      await expect(
        reorderTicketTiers(
          format.id,
          tiers.map((t) => t.id),
        ),
      ).rejects.toThrow(/injected failure/);
      expect(
        (await testDb.ticketTier.findMany({ orderBy: { id: "asc" } })).map(
          (t) => t.order,
        ),
      ).toEqual([10, 11]);
    } finally {
      await db.prepare("DROP TRIGGER fail_tier").run();
    }
  });
});
describe("SQLite compatibility", () => {
  it("round trips JSON objects, arrays, SQL NULL, JSON null and UTC dates", async () => {
    const band = await createBand({
      snsLinks: { twitter: "https://example.com" },
    });
    expect(band.snsLinks).toEqual({ twitter: "https://example.com" });
    const stored = await getDb()
      .prepare("SELECT typeof(sns_links) AS kind FROM band WHERE id = ?")
      .bind(band.id)
      .first();
    expect(stored?.kind).toBe("text");
    await testDb.band.update({
      where: { id: band.id },
      data: { snsLinks: Prisma.JsonNull },
    });
    let row = await getDb()
      .prepare("SELECT sns_links FROM band WHERE id = ?")
      .bind(band.id)
      .first();
    expect(row?.sns_links).toBe("null");
    await testDb.band.update({
      where: { id: band.id },
      data: { snsLinks: Prisma.DbNull },
    });
    row = await getDb()
      .prepare("SELECT sns_links FROM band WHERE id = ?")
      .bind(band.id)
      .first();
    expect(row?.sns_links).toBeNull();
    const date = new Date("2026-10-01T09:00:00.123Z");
    const live = await createLive({
      officialUrls: ["https://example.com"],
      startAt: date,
    });
    expect(live.officialUrls).toEqual(["https://example.com"]);
    expect(live.startAt.toISOString()).toBe(date.toISOString());
    expect(live.status).toBe("DRAFT");
  });
  it("preserves Unicode case-insensitive search before pagination and counts", async () => {
    const nameEn = "MyGO μ's 日本 한국 École";
    const band = await createBand({ nameEn });
    await createBand({ nameEn });
    const work = await createWorkRow({ nameEn });
    await createSeries({ nameEn });
    await createTour({ workId: work.id, nameEn });
    await createLive({ titleEn: nameEn });
    await createLive({ titleEn: nameEn, deletedAt: new Date() });
    for (const query of ["mygo", "Μ'S", "日本", "한국", "ÉCOLE", "e\u0301cole", "Μ%日本", "Μ_S"]) {
      expect((await searchBands(query, 1)).map((row) => row.id)).toEqual([band.id]);
      const page = await searchBandsForAdmin({ q: query, skip: 1, take: 1 });
      expect(page.total).toBe(2);
      expect(page.rows).toHaveLength(1);
      for (const search of [searchWorks, searchSeries, searchTours, searchLivesForAdmin]) {
        const result = await search({ q: query, skip: 0, take: 1 });
        expect(result.total).toBe(1);
        expect(result.rows).toHaveLength(1);
      }
    }
    expect((await searchBandsForAdmin({ q: "Μ'S", workId: work.id, skip: 0, take: 5 })).total).toBe(0);
  });
  it("enforces foreign keys, cascades and generated ids / RETURNING", async () => {
    const { input, live } = await fixture();
    const sale = await createTicketSale(input);
    expect(sale.id).toBeGreaterThan(0);
    expect(sale.tiers).toHaveLength(2);
    await expect(
      testDb.ticketSaleTier.create({
        data: { saleId: sale.id, tierId: 999999 },
      }),
    ).rejects.toThrow();
    await testDb.live.delete({ where: { id: live.id } });
    expect(await testDb.ticketSaleTier.count()).toBe(0);
    expect(await testDb.ticketSale.count()).toBe(0);
  });
});
