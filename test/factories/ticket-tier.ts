/**
 * TicketTier 팩토리.
 *
 * LiveFormat 가 먼저 존재해야 한다.
 * 함수명은 repo 의 `createTicketTier` 와 충돌하지 않도록 `Row` suffix.
 */
import type { Prisma, TicketTier } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type TicketTierOverrides = Partial<Prisma.TicketTierUncheckedCreateInput>;

export async function createTicketTierRow(
  formatId: number,
  overrides: TicketTierOverrides = {}
): Promise<TicketTier> {
  counter += 1;
  return testDb.ticketTier.create({
    data: {
      formatId,
      name: `S席-${counter}`,
      priceJpy: 9800,
      order: 0,
      ...overrides,
    },
  });
}
