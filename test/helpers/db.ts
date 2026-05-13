/**
 * Integration test DB helper.
 *
 * 사용 환경변수:
 *  - TEST_DATABASE_URL (우선)
 *  - DATABASE_URL (fallback)
 *
 * `resetDb()` 는 모든 도메인 테이블을 TRUNCATE CASCADE 하여 격리를 강제한다.
 * Prisma client 의 트랜잭션 격리로는 Server Action 등 별도 connection 경계를
 * 가진 호출을 커버할 수 없어 TRUNCATE 방식을 사용한다.
 */
import { PrismaClient } from "@prisma/client";

const url =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export const testDb = new PrismaClient({
  datasources: { db: { url } },
});

/**
 * 도메인 테이블 목록. 외래키 의존성을 무시하기 위해 CASCADE 사용.
 * 스키마에 새 모델이 추가되면 본 배열도 갱신해야 한다.
 */
const TABLES = [
  "ticket_sale_tier",
  "ticket_sale",
  "ticket_tier",
  "live_format",
  "live_band",
  "live",
  "band",
  "work",
  "series",
  "vendor",
];

export async function resetDb(): Promise<void> {
  await testDb.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

export async function disconnectDb(): Promise<void> {
  await testDb.$disconnect();
}
