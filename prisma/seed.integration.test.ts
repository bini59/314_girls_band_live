/**
 * Vendor 시드 & Live status/soft-delete 스키마 통합 테스트.
 *
 * 본 테스트는 실제 Postgres 가 켜져 있어야 한다.
 * TEST_DATABASE_URL (또는 fallback DATABASE_URL) 사용.
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

describe("schema - LiveStatus enum / Live.status / Live.deletedAt", () => {
  it("LiveStatus enum 의 'DRAFT', 'PUBLISHED' 두 값이 DB 에 존재한다", async () => {
    const rows = await testDb.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'LiveStatus'
       ORDER BY e.enumsortorder`
    );
    const labels = rows.map((r) => r.enumlabel);
    expect(labels).toEqual(["DRAFT", "PUBLISHED"]);
  });

  it("live 테이블에 'status' 컬럼 (LiveStatus, NOT NULL, default DRAFT) 이 존재한다", async () => {
    const rows = await testDb.$queryRawUnsafe<
      Array<{
        column_name: string;
        is_nullable: string;
        column_default: string | null;
        udt_name: string;
      }>
    >(
      `SELECT column_name, is_nullable, column_default, udt_name
       FROM information_schema.columns
       WHERE table_name = 'live' AND column_name = 'status'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].is_nullable).toBe("NO");
    expect(rows[0].column_default).toMatch(/DRAFT/);
  });

  it("live 테이블에 'deleted_at' 컬럼 (timestamp, nullable) 이 존재한다", async () => {
    const rows = await testDb.$queryRawUnsafe<
      Array<{ column_name: string; is_nullable: string; data_type: string }>
    >(
      `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
       WHERE table_name = 'live' AND column_name = 'deleted_at'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].is_nullable).toBe("YES");
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
