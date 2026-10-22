/**
 * Vendor 시드 & Live status/soft-delete 스키마 통합 테스트.
 *
 * 테스트 셋업이 로컬 workerd D1을 생성한다.
 *
 * 검증 항목:
 *  - LiveStatus enum (DRAFT, PUBLISHED) 존재
 *  - Live.status / Live.deleted_at 컬럼 존재
 *  - seedVendors() 가 6개 vendor 를 정확한 slug + baseUrl 로 upsert
 *  - 멱등 (2회 실행해도 6개 유지)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { testDb, resetDb, disconnectDb } from "../test/helpers/db";

beforeAll(async () => {
  // 연결 확인
  await testDb.$connect();
});

afterAll(async () => {
  await disconnectDb();
});

beforeEach(async () => {
  await resetDb();
});

describe("SQLite schema", () => {
  it("stores enums as TEXT and preserves defaults / nullable dates", async () => {
    const rows = await testDb.$queryRawUnsafe<Array<{name: string; type: string; notnull: bigint; dflt_value: string | null}>>("PRAGMA table_info(live)");
    expect(rows.find(row => row.name === "status")).toMatchObject({ type: "TEXT", dflt_value: "'DRAFT'" });
    expect(Number(rows.find(row => row.name === "deleted_at")?.notnull)).toBe(0);
  });
});

describe("seedVendors - 6 vendor upsert (멱등)", () => {
  it("빈 DB 에 시드 실행 시 vendor 6개 생성", async () => {
    const { seedVendors } = await import("./seed");
    await seedVendors(testDb);

    const count = await testDb.vendor.count();
    expect(count).toBe(6);
  });

  it("각 vendor 의 slug 가 예상 값", async () => {
    const { seedVendors } = await import("./seed");
    await seedVendors(testDb);

    const vendors = await testDb.vendor.findMany({
      orderBy: { id: "asc" },
      select: { slug: true },
    });
    const slugs = vendors.map((v) => v.slug).sort();

    expect(slugs).toEqual(
      [
        "eplus",
        "lawson-ticket",
        "ticket-pia",
        "cn-playguide",
        "rakuten-ticket",
        "bushiroad-music",
      ].sort()
    );
  });

  it("각 vendor 가 baseUrl 을 보유하고, 도메인이 예상 값과 일치", async () => {
    const { seedVendors } = await import("./seed");
    await seedVendors(testDb);

    const expected: Record<string, string> = {
      eplus: "eplus.jp",
      "lawson-ticket": "l-tike.com",
      "ticket-pia": "t.pia.jp",
      "cn-playguide": "cnplayguide.com",
      "rakuten-ticket": "ticket.rakuten.co.jp",
      "bushiroad-music": "bushi-road-music.bushimo.jp",
    };

    const vendors = await testDb.vendor.findMany();
    for (const v of vendors) {
      expect(v.baseUrl).toBeTruthy();
      const expectedHost = expected[v.slug];
      expect(expectedHost).toBeDefined();
      // baseUrl 의 hostname 이 예상 도메인과 정확히 일치
      const host = new URL(v.baseUrl as string).hostname.toLowerCase();
      expect(host).toBe(expectedHost);
    }
  });

  it("시드를 2회 실행해도 vendor 가 정확히 6개 (멱등)", async () => {
    const { seedVendors } = await import("./seed");
    await seedVendors(testDb);
    await seedVendors(testDb);

    const count = await testDb.vendor.count();
    expect(count).toBe(6);
  });
});
