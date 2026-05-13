/**
 * Vendor 시드 (멱등).
 *
 * 일본 라이브 티켓 판매처 6종:
 *  - e+ (イープラス)
 *  - ローソンチケット
 *  - チケットぴあ
 *  - CNプレイガイド
 *  - 楽天チケット
 *  - Bushiroad MUSIC FC
 *
 * 본 시드는 upsert 기반으로 멱등하다 — 반복 실행해도 동일한 6개의
 * vendor row만 유지된다.
 *
 * 실행:
 *   pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";

export const VENDORS = [
  { slug: "eplus",           name: "e+ (イープラス)",      baseUrl: "https://eplus.jp" },
  { slug: "lawson-ticket",   name: "ローソンチケット",     baseUrl: "https://l-tike.com" },
  { slug: "ticket-pia",      name: "チケットぴあ",         baseUrl: "https://t.pia.jp" },
  { slug: "cn-playguide",    name: "CNプレイガイド",       baseUrl: "https://cnplayguide.com" },
  { slug: "rakuten-ticket",  name: "楽天チケット",         baseUrl: "https://ticket.rakuten.co.jp" },
  { slug: "bushiroad-music", name: "Bushiroad MUSIC FC",   baseUrl: "https://bushi-road-music.bushimo.jp" },
] as const;

/**
 * 운영 환경에서 시드를 막는 안전장치.
 * production 에서 시드가 돌면 운영 데이터가 코드값으로 덮어쓰일 위험.
 */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
    throw new Error(
      "Refusing to seed in production. Set ALLOW_PROD_SEED=1 to override (지양)."
    );
  }
}

/**
 * Vendor 6개를 멱등 upsert. PrismaClient 를 주입받아 connection 누수 방지.
 * 미주입 시 기본 클라이언트 생성 후 호출자가 disconnect 책임 (CLI 진입점에서만).
 */
export async function seedVendors(client: PrismaClient): Promise<void> {
  for (const v of VENDORS) {
    await client.vendor.upsert({
      where: { slug: v.slug },
      create: v,
      update: { name: v.name, baseUrl: v.baseUrl },
    });
  }
}

export async function seedAll(client: PrismaClient): Promise<void> {
  await seedVendors(client);
}

// ─── CLI 진입점 (ESM 호환) ──────────────────────────────────────────
async function runCli(): Promise<void> {
  assertNotProduction();
  const prisma = new PrismaClient();
  try {
    await seedAll(prisma);
    // eslint-disable-next-line no-console
    console.log("Seed completed");
  } finally {
    await prisma.$disconnect();
  }
}

// import.meta.url 로 ESM 직접 실행 감지. require.main 은 ESM 에서 작동하지 않음.
const isDirectRun = (() => {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  runCli().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
