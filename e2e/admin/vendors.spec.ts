import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 판매처 관리 E2E.
 *
 * 시나리오:
 *   1. 로그인 후 /admin/vendors 진입
 *   2. + 판매처 추가 → "ee-plus" / "イープラス" 입력 → 저장 → 목록 표시
 *   3. 편집 → 이름 변경 → 저장 → 변경된 이름 노출
 *   4. 삭제 → 목록에서 사라짐
 */

const TS = String(Date.now());
const SLUG = `ee-plus-${TS}`;
const NAME = `イープラス ${TS}`;
const NAME_EDITED = `${NAME} 수정`;

test.describe("어드민 판매처 관리", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("판매처 추가 → 편집 → 삭제 (참조 없음)", async ({ page }) => {
    // 1. /admin/vendors 진입
    await page.goto("/admin/vendors");
    await expect(page).toHaveURL(/\/admin\/vendors$/);
    await expect(
      page.getByRole("heading", { name: "판매처 관리" })
    ).toBeVisible();

    // 2. 추가 다이얼로그 오픈
    await page.getByRole("button", { name: /\+ 판매처 추가/ }).click();
    await expect(
      page.getByRole("heading", { name: /판매처 추가/ })
    ).toBeVisible();

    // 3. 입력 → 저장
    await page.getByLabel("slug").fill(SLUG);
    await page.getByLabel("표시 이름").fill(NAME);
    await page.getByLabel("기본 URL (선택)").fill("https://eplus.jp");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^저장$/ })
      .click();

    // 4. 목록에 노출
    await expect(page.getByText(SLUG)).toBeVisible();
    await expect(page.getByText(NAME)).toBeVisible();

    // 5. 편집 → 이름 변경
    await page.getByRole("button", { name: new RegExp(`${NAME} 편집`) }).click();
    await expect(
      page.getByRole("heading", { name: /판매처 편집/ })
    ).toBeVisible();
    await page.getByLabel("표시 이름").fill(NAME_EDITED);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^저장$/ })
      .click();

    await expect(page.getByText(NAME_EDITED)).toBeVisible();

    // 6. 삭제 (참조 없음 → 성공)
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: new RegExp(`${NAME_EDITED} 삭제`) })
      .click();

    // 목록에서 사라짐
    await expect(page.getByText(NAME_EDITED)).toHaveCount(0);
  });
});
