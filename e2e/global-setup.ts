import { prepareE2EEnv } from "./prepare-env";

/**
 * Playwright global setup.
 *
 * playwright.config.ts 의 모듈 로드 시점에 동일한 prepareE2EEnv() 가 이미
 * 실행되어 `process.env` 와 `webServer.env` 가 채워진다.
 * globalSetup 자체는 idempotent 한 보강 호출 + 향후 DB 시드 훅 자리.
 */
export default async function globalSetup(): Promise<void> {
  await prepareE2EEnv();
}
