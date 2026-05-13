import { defineConfig, devices } from "@playwright/test";
import { prepareE2EEnvSync } from "./e2e/prepare-env";

// E2E 환경변수 준비.
//
// 보안 강화 (코드 리뷰 C1):
//   과거에는 .env.local 을 매번 덮어써서 개발자 로컬 설정을 파괴할 위험이 있었다.
//   이제는 파일에 쓰지 않고, 자식 프로세스 환경변수(webServer.env)로 직접 주입한다.
//
// 호출 흐름:
//   1) 이 시점(config 모듈 로드)에 prepareE2EEnvSync() 가 process.env 에 값을 채운다.
//      → webServer.env 에 그 값을 매핑해 Next.js dev 서버 자식 프로세스에 전달.
//   2) e2e/global-setup.ts 도 멱등 호출 (현재는 보강용, 추후 DB 시드 훅 자리).
const e2eEnv = prepareE2EEnvSync();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "ko-KR",
    timezoneId: "Asia/Tokyo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // 자식 프로세스에 직접 환경변수 주입.
    // child_process.spawn 의 env 옵션으로 전달되어 셸 확장이 일어나지 않으므로
    // bcrypt 해시('$' 포함)의 변수 확장 문제도 없다.
    env: {
      ADMIN_PASSWORD: e2eEnv.ADMIN_PASSWORD,
      ADMIN_PASSWORD_HASH: e2eEnv.ADMIN_PASSWORD_HASH,
      JWT_SECRET: e2eEnv.JWT_SECRET,
      NODE_ENV: e2eEnv.NODE_ENV,
    },
  },
});
