import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

test.describe("어드민 로그인", () => {
  test("비로그인 상태로 /admin/lives 직접 접근 시 /admin/login 으로 리다이렉트", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/lives");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin/login 페이지에 password input(name=password)과 submit 버튼이 렌더된다", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("틀린 비밀번호 입력 시 '로그인 실패' 메시지가 화면에 표시되고 /admin/login 에 머문다", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/login");
    await page.fill('input[name="password"]', "absolutely-wrong-password");
    await page.click('button[type="submit"]');

    await expect(page.getByText("로그인 실패")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("올바른 비밀번호 입력 시 /admin/lives 로 이동하고 어드민 셸이 보인다", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await signInAsAdmin(page);

    await expect(page).toHaveURL(/\/admin\/lives$/);
    // 본 사이클에서 placeholder 페이지가 실제 라이브 목록 UI 로 대체되었다.
    // "라이브 관리" 헤딩 또는 "+ 새 라이브" 버튼이 보이는지로 도착 검증.
    await expect(
      page.getByRole("heading", { name: /라이브 관리|라이브/ })
    ).toBeVisible();
  });

  test("로그인 후 새로고침해도 /admin/lives 가 유지된다 (쿠키 영속성)", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await signInAsAdmin(page);

    await page.reload();
    await expect(page).toHaveURL(/\/admin\/lives$/);
    // 로그인 페이지로 튕기지 않음을 확인
    await expect(page).not.toHaveURL(/\/admin\/login/);
  });
});
