import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 마스터 데이터 (시리즈/작품/밴드) E2E.
 *
 * 시나리오:
 *   1. 사이드바에서 시리즈/작품/밴드 메뉴 활성화 확인
 *   2. 시리즈 신규 → 편집 → 삭제 (모달 UI 유지)
 *   3. 작품 신규 (상세 페이지) → 편집 (상세 페이지)
 *   4. 밴드 신규 (상세 페이지) → 편집 (상세 페이지)
 *   5. 밴드 보유 작품 삭제 시도 → 차단 메시지
 */

const TS = String(Date.now());
const SERIES_SLUG = `e2e-lv-${TS}`;
const SERIES_NAME_KO = `러브라이브 E2E ${TS}`;
const WORK_SLUG = `e2e-lv-anime-${TS}`;
const WORK_NAME_KO = `러브라이브! E2E ${TS}`;
const BAND_SLUG = `e2e-mygo-${TS}`;
const BAND_NAME_KO = `마이고 E2E ${TS}`;

test.describe("어드민 마스터 데이터", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("사이드바: 시리즈/작품/밴드 메뉴 활성화", async ({ page }) => {
    await page.goto("/admin/lives");
    const nav = page.getByRole("navigation", { name: "어드민 메뉴" });
    await expect(nav.getByRole("link", { name: "시리즈" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "작품" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "밴드" })).toBeVisible();
  });

  test("시리즈 → 작품 → 밴드 신규/편집 + 삭제 차단", async ({ page }) => {
    // 1) 시리즈 추가 (모달)
    await page.goto("/admin/series");
    await expect(
      page.getByRole("heading", { name: "시리즈 관리" })
    ).toBeVisible();

    await page.getByRole("button", { name: /\+ 시리즈 추가/ }).click();
    await page.getByLabel("slug").fill(SERIES_SLUG);
    await page.getByLabel("한국어 이름").fill(SERIES_NAME_KO);
    await page.getByLabel("일본어 이름").fill("ラブライブ E2E");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^저장$/ })
      .click();
    await expect(page.getByText(SERIES_NAME_KO)).toBeVisible();

    // 2) 작품 추가 (상세 페이지)
    await page.goto("/admin/works");
    await expect(
      page.getByRole("heading", { name: "작품 관리" })
    ).toBeVisible();

    await page.getByRole("link", { name: /\+ 작품 추가/ }).click();
    await expect(
      page.getByRole("heading", { name: "작품 추가" })
    ).toBeVisible();
    await page.getByLabel("slug").fill(WORK_SLUG);
    await page.getByLabel("한국어 이름").fill(WORK_NAME_KO);
    await page.getByLabel("일본어 이름").fill("ラブライブ! E2E");
    await page
      .getByLabel("시리즈 (선택)")
      .selectOption({ label: new RegExp(SERIES_NAME_KO) });
    await page.getByRole("button", { name: /^저장$/ }).click();

    await expect(page).toHaveURL(/\/admin\/works$/);
    await expect(page.getByText(WORK_NAME_KO)).toBeVisible();
    const workRow = page.getByText(WORK_NAME_KO).locator("..").locator("..");
    await expect(workRow).toContainText(SERIES_NAME_KO);

    // 3) 밴드 추가 (상세 페이지)
    await page.goto("/admin/bands");
    await expect(
      page.getByRole("heading", { name: "밴드 관리" })
    ).toBeVisible();

    await page.getByRole("link", { name: /\+ 밴드 추가/ }).click();
    await expect(
      page.getByRole("heading", { name: "밴드 추가" })
    ).toBeVisible();
    await page
      .getByLabel("작품")
      .selectOption({ label: new RegExp(WORK_NAME_KO) });
    await page.getByLabel("slug").fill(BAND_SLUG);
    await page.getByLabel("한국어 이름").fill(BAND_NAME_KO);
    await page.getByLabel("일본어 이름").fill("MyGO E2E");

    // SNS 추가 (추천 키 twitter)
    await page.getByRole("button", { name: /^\+ twitter$/ }).click();
    await page.getByLabel("SNS URL 1").fill("https://twitter.com/mygo_e2e");

    await page.getByRole("button", { name: /^저장$/ }).click();

    await expect(page).toHaveURL(/\/admin\/bands$/);
    await expect(page.getByText(BAND_NAME_KO)).toBeVisible();

    // 4) 작품 삭제 시도 → 밴드가 있으므로 차단
    await page.goto("/admin/works");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: new RegExp(`${WORK_NAME_KO} 삭제`) })
      .click();
    await expect(
      page.getByText(/사용 중인 작품은 삭제할 수 없습니다/)
    ).toBeVisible();

    // 5) 정리: 밴드 → 작품 → 시리즈 순으로 삭제
    await page.goto("/admin/bands");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: new RegExp(`${BAND_NAME_KO} 삭제`) })
      .click();
    await expect(page.getByText(BAND_NAME_KO)).toHaveCount(0);

    await page.goto("/admin/works");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: new RegExp(`${WORK_NAME_KO} 삭제`) })
      .click();
    await expect(page.getByText(WORK_NAME_KO)).toHaveCount(0);

    await page.goto("/admin/series");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: new RegExp(`${SERIES_NAME_KO} 삭제`) })
      .click();
    await expect(page.getByText(SERIES_NAME_KO)).toHaveCount(0);
  });
});
