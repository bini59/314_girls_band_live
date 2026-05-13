// Vitest 전역 setup.
// integration 테스트가 도입되면 여기서 DB reset/connection 관리.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.VITEST) {
  throw new Error("test/setup.ts must only be loaded by vitest");
}

// 시각 컨벤션: 모든 테스트는 JST 기준 동작이 정상인지 확인.
process.env.TZ = "Asia/Tokyo";

// `.env` 파일 로드 (Vitest 는 기본적으로 .env 를 자동 로드하지 않음).
// 외부 dotenv 의존성을 추가하지 않기 위해 최소 파서 사용.
// 이미 환경변수가 설정되어 있으면 덮어쓰지 않는다 (CI 우선).
function loadDotenv(filename: string): void {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) return;
  const content = readFileSync(filepath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 양쪽 따옴표 제거 (single/double).
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotenv(".env");

// 통합 테스트는 TEST_DATABASE_URL 을 사용해야 한다.
// `prisma/seed.ts` 등 내부에서 `new PrismaClient()` 를 만드는 코드는
// 환경변수의 DATABASE_URL 을 그대로 읽는다. 테스트 격리를 위해
// DATABASE_URL 을 TEST_DATABASE_URL 로 강제 덮어쓴다.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for integration tests. Refusing to use production DATABASE_URL."
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
