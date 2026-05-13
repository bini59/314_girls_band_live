import type { Page } from "@playwright/test";

/**
 * E2E 헬퍼: 어드민 로그인 폼을 채워서 인증 쿠키를 획득한다.
 *
 * 사전 조건:
 *  - process.env.ADMIN_PASSWORD 에 평문 비밀번호가 주입돼 있어야 한다.
 *    (e2e/global-setup.ts 가 bcrypt 해시로 ADMIN_PASSWORD_HASH 도 함께 주입)
 *
 * 동작:
 *  1. /admin/login 으로 이동
 *  2. password input 채움
 *  3. submit
 *  4. /admin/lives 로 리다이렉트될 때까지 대기
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  const plain = process.env.ADMIN_PASSWORD;
  if (!plain) {
    throw new Error(
      "signInAsAdmin: process.env.ADMIN_PASSWORD 가 비어있다. e2e/global-setup.ts 에서 주입돼야 한다."
    );
  }

  await page.goto("/admin/login");
  await page.fill('input[name="password"]', plain);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/lives$/);
}
