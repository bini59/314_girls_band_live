import { prepareE2EEnv } from "./prepare-env";

/**
 * Playwright global setup.
 *
 * playwright.config.ts 의 모듈 로드 시점에 동일한 prepareE2EEnv() 가 이미
 * 실행되어 `process.env` 와 `webServer.env` 가 채워진다.
 * globalSetup 자체는 idempotent 한 보강 호출 + DB 시드 훅 자리.
 *
 * 본 사이클 추가: 어드민 라이브 목록 / 등록 / 편집 E2E 가 빈 DB 를 가정하므로
 * 시작 전에 도메인 테이블을 TRUNCATE 한다. 외부 시드는 사용하지 않는다.
 */
export default async function globalSetup(): Promise<void> {
  await prepareE2EEnv();
  await resetAdminTables();
}

async function resetAdminTables(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("globalSetup: DATABASE_URL 이 없습니다.");
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "ticket_sale_tier", "ticket_sale", "ticket_tier", "live_format", "live_band", "live", "band", "work", "series", "vendor" RESTART IDENTITY CASCADE`
    );
  } finally {
    await prisma.$disconnect();
  }
}
