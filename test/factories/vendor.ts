/**
 * Vendor 팩토리.
 *
 * 발매처(e+, 로손, FC 등) row 를 빠르게 만들기 위한 헬퍼.
 * slug 는 카운터 기반으로 중복 회피.
 */
import type { Prisma, Vendor } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type VendorOverrides = Partial<Prisma.VendorUncheckedCreateInput>;

export async function createVendorRow(
  overrides: VendorOverrides = {}
): Promise<Vendor> {
  counter += 1;
  return testDb.vendor.create({
    data: {
      slug: `e-plus-${counter}`,
      name: "イープラス",
      baseUrl: "https://eplus.jp",
      ...overrides,
    },
  });
}
