/**
 * Vendor 레포지토리 통합 테스트.
 *
 *  - CRUD + slug unique violation (P2002) → "이미 사용 중인 slug".
 *  - 삭제 시 FK constraint (TicketSale.vendorId Restrict) → "사용 중인 발매처".
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createVendorRow } from "@/test/factories/vendor";
import { createTicketSaleRow } from "@/test/factories/ticket-sale";

import {
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listVendors", () => {
  it("빈 DB → []", async () => {
    expect(await listVendors()).toEqual([]);
  });

  it("name asc 정렬", async () => {
    await createVendorRow({ slug: "z-fc", name: "Z FC" });
    await createVendorRow({ slug: "a-eplus", name: "Aプラス" });
    await createVendorRow({ slug: "m-lawson", name: "Mawson" });

    const result = await listVendors();
    expect(result.map((v) => v.name)).toEqual(["Aプラス", "Mawson", "Z FC"]);
  });
});

describe("getVendorById", () => {
  it("존재하면 row", async () => {
    const v = await createVendorRow();
    const got = await getVendorById(v.id);
    expect(got?.id).toBe(v.id);
  });

  it("존재하지 않으면 null", async () => {
    expect(await getVendorById(999999)).toBeNull();
  });
});

describe("createVendor", () => {
  it("정상 생성", async () => {
    const v = await createVendor({
      slug: "eplus-create",
      name: "イープラス",
      baseUrl: "https://eplus.jp",
    });
    expect(v.slug).toBe("eplus-create");
    expect(v.name).toBe("イープラス");
    expect(v.baseUrl).toBe("https://eplus.jp");
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    await createVendor({ slug: "dup-slug", name: "first" });
    await expect(
      createVendor({ slug: "dup-slug", name: "second" })
    ).rejects.toThrow(/이미 사용 중인 slug/);
  });
});

describe("updateVendor", () => {
  it("부분 패치", async () => {
    const v = await createVendorRow();
    const updated = await updateVendor(v.id, { name: "新しい名前" });
    expect(updated.name).toBe("新しい名前");
    expect(updated.slug).toBe(v.slug);
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(updateVendor(999999, { name: "x" })).rejects.toThrow(
      /찾을 수 없/
    );
  });

  it("slug 중복 → throw '이미 사용 중인 slug'", async () => {
    const v1 = await createVendorRow({ slug: "occupied-slug" });
    const v2 = await createVendorRow({ slug: "another-slug" });

    await expect(
      updateVendor(v2.id, { slug: v1.slug })
    ).rejects.toThrow(/이미 사용 중인 slug/);
  });
});

describe("deleteVendor", () => {
  it("정상 삭제", async () => {
    const v = await createVendorRow();
    await deleteVendor(v.id);
    expect(await getVendorById(v.id)).toBeNull();
  });

  it("TicketSale 가 참조 중이면 throw '사용 중인 발매처는 삭제할 수 없습니다'", async () => {
    const live = await createLive();
    const v = await createVendorRow();
    await createTicketSaleRow(live.id, v.id);

    await expect(deleteVendor(v.id)).rejects.toThrow(
      /사용 중인 발매처는 삭제할 수 없습니다/
    );

    // vendor 는 그대로 존재
    expect(await getVendorById(v.id)).not.toBeNull();
  });

  it("존재하지 않는 id → throw '찾을 수 없'", async () => {
    await expect(deleteVendor(999999)).rejects.toThrow(/찾을 수 없/);
  });

  it("참조하던 TicketSale 이 사라지면 삭제 가능", async () => {
    const live = await createLive();
    const v = await createVendorRow();
    const sale = await createTicketSaleRow(live.id, v.id);

    // TicketSale 제거 후 vendor 삭제
    await testDb.ticketSale.delete({ where: { id: sale.id } });
    await deleteVendor(v.id);
    expect(await getVendorById(v.id)).toBeNull();
  });
});
