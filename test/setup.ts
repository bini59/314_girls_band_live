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

// Each Vitest process owns an ephemeral local workerd D1 instance.
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { afterAll } from "vitest";
if (typeof document === "undefined") {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test'); } }",
    compatibilityDate: "2026-07-30",
    d1Databases: ["DB"],
  });
  const db = await mf.getD1Database("DB");
  (globalThis as typeof globalThis & { __testD1?: D1Database }).__testD1 =
    db as unknown as D1Database;
  const sql = readFileSync(resolve("prisma/migrations/0001_init.sql"), "utf8");
  await db.batch(
    sql
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s)),
  );
  afterAll(async () => {
    await mf.dispose();
  });
}

// React Testing Library cleanup — 각 test 후 unmount + DOM 비움.
// jsdom 환경의 component test 만 영향을 받는다 (node env 테스트는 무시).
import { afterEach } from "vitest";
try {
  // @testing-library/react 가 설치돼 있으면 cleanup 등록.
  // dynamic import 가 어려운 환경이라 require 사용.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rtl = require("@testing-library/react") as { cleanup?: () => void };
  if (typeof rtl.cleanup === "function") {
    afterEach(() => {
      rtl.cleanup?.();
    });
  }
} catch {
  // 설치되지 않은 환경(unit/integration only) 은 조용히 패스.
}
