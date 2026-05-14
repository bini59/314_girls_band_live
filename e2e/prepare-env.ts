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
  // E2E 는 항상 자체 평문/해시 쌍을 만든다. 사용자 `.env` 에 dev 비밀번호 해시가
  // 있어도 (pnpm/도구가 자동 로드한 케이스 포함) E2E 평문과 매칭되지 않으므로,
  // 멱등 가드 대신 매번 새 평문을 만들고 그 해시를 강제 set 한다.
  // 이미 같은 playwright 실행 내에서 한 번 만들었으면 동일 평문 재사용 (테스트
  // 헬퍼가 process.env.ADMIN_PASSWORD 를 직접 읽으므로 흐름 일관성 필요).
  const isFreshRun =
    !process.env.ADMIN_PASSWORD ||
    !process.env.ADMIN_PASSWORD.startsWith("e2e-test-password-");

  if (isFreshRun) {
    process.env.ADMIN_PASSWORD =
      "e2e-test-password-" + randomBytes(4).toString("hex");
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(
      process.env.ADMIN_PASSWORD,
      4
    );
    // JWT_SECRET 도 같은 실행에서 한 번만 재생성. 사용자 .env 의 32바이트
    // 미만일 수도 있으니 모자라면 강제 교체.
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      process.env.JWT_SECRET = randomBytes(32).toString("hex");
    }
  }

  // Sanity: 평문/해시가 실제로 매칭되는지 검증 (회귀 디버그용).
  // 실패 시 즉시 throw — webServer 띄우기 전에 알 수 있음.
  const sanityOk = bcrypt.compareSync(
    process.env.ADMIN_PASSWORD!,
    process.env.ADMIN_PASSWORD_HASH!
  );
  if (!sanityOk) {
    throw new Error(
      `prepareE2EEnvSync: ADMIN_PASSWORD 와 ADMIN_PASSWORD_HASH 가 매칭되지 않습니다. ` +
        `ADMIN_PASSWORD prefix="${process.env.ADMIN_PASSWORD!.slice(0, 20)}", ` +
        `HASH prefix="${process.env.ADMIN_PASSWORD_HASH!.slice(0, 10)}"`
    );
  }

  return {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD!,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH!,
    JWT_SECRET: process.env.JWT_SECRET!,
    // E2E 는 dev 서버에 대해 동작 (HTTP, secure=false, __Host- prefix 미적용).
    NODE_ENV: "development",
  };
}

export async function prepareE2EEnv(): Promise<E2EEnv> {
  return prepareE2EEnvSync();
}
