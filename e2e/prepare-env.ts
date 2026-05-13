import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

/**
 * E2E 환경변수 준비.
 *
 * 안전성 정책 (코드 리뷰 C1):
 *  - **파일 시스템에 쓰지 않는다.** 과거에는 `.env.local` 을 매번 덮어써서
 *    개발자의 로컬 설정을 파괴할 위험이 있었다. 이를 제거하고
 *    `playwright.config.ts` 의 `webServer.env` 로 자식 프로세스(Next.js dev
 *    서버)에 직접 주입한다.
 *  - `process.env` 에는 한 번만 set (이미 값이 있으면 재사용). 멱등.
 *
 * 호출 시점:
 *  - `playwright.config.ts` 모듈 로드 시 (webServer 시작 전): 이 결과를
 *    `webServer.env` 에 매핑.
 *  - `globalSetup`: 향후 DB 시드/마이그레이션 등의 훅 자리. env 보강은 멱등.
 *
 * bcrypt 해시는 '$' 가 포함되어 일부 셸/도구의 env 확장에 취약하지만,
 * Playwright 의 `webServer.env` 는 `child_process.spawn` 의 `env` 옵션으로
 * 직접 전달되어 셸 확장이 일어나지 않으므로 안전하다.
 */
export interface E2EEnv {
  ADMIN_PASSWORD: string;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
  NODE_ENV: "development";
}

/**
 * Sync 변형. playwright.config.ts 의 top-level (async 불가) 에서 호출하기 위해
 * `bcrypt.hashSync` 를 사용한다. round=4 라 무거운 비용은 아니다.
 */
export function prepareE2EEnvSync(): E2EEnv {
  if (!process.env.ADMIN_PASSWORD) {
    process.env.ADMIN_PASSWORD =
      "e2e-test-password-" + randomBytes(4).toString("hex");
  }

  if (!process.env.ADMIN_PASSWORD_HASH) {
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(
      process.env.ADMIN_PASSWORD,
      4
    );
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
  }

  return {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    JWT_SECRET: process.env.JWT_SECRET,
    // E2E 는 dev 서버에 대해 동작 (HTTP, secure=false, __Host- prefix 미적용).
    NODE_ENV: "development",
  };
}

export async function prepareE2EEnv(): Promise<E2EEnv> {
  return prepareE2EEnvSync();
}
