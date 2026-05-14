/**
 * TicketSale 팩토리.
 *
 * Live + Vendor 가 먼저 존재해야 한다.
 * `linkTicketSaleTier` 로 TicketSale↔TicketTier 조인 row 도 직접 만들 수 있다.
 */
import type { Prisma, TicketSale, TicketSaleTier } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type TicketSaleOverrides = Partial<Prisma.TicketSaleUncheckedCreateInput>;

export async function createTicketSaleRow(
  liveId: number,
  vendorId: number,
  overrides: TicketSaleOverrides = {}
): Promise<TicketSale> {
  counter += 1;
  return testDb.ticketSale.create({
    data: {
      liveId,
      vendorId,
      type: "FC_SENKO",
      method: "LOTTERY",
      label: `FC 最速先行 #${counter}`,
      // JST 2026-01-10 12:00 = UTC 2026-01-10 03:00
      startsAt: new Date("2026-01-10T03:00:00Z"),
      endsAt: new Date("2026-01-15T15:00:00Z"),
      ...overrides,
    },
  });
}

export async function linkTicketSaleTier(
  saleId: number,
  tierId: number
): Promise<TicketSaleTier> {
  return testDb.ticketSaleTier.create({
    data: { saleId, tierId },
  });
}
