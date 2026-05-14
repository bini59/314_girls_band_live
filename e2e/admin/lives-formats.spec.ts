import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 라이브 — 포맷(LiveFormat) 섹션 E2E.
 *
 * 시나리오:
 *   1. 로그인 + 새 라이브 생성
 *   2. 편집기 진입 → 기본 LIVE_VENUE 포맷이 자동 생성돼 있음
 *   3. "+ 포맷 추가" → LIVE_VIEWING ("전국 5관 LV") 추가
 *   4. 편집 → 라벨 변경
 *   5. 삭제 (confirm 2 단계)
 */

const TS = String(Date.now());

const VALID_INPUT = {
  titleKo: `포맷 E2E ${TS}`,
  titleJp: `フォーマット E2E ${TS}`,
  titleEn: `format-e2e-${TS}`,
  type: "SOLO",
  startAtJst: "2026-09-20T18:00",
  venueName: `Format Venue ${TS}`,
};

test.describe("어드민 라이브 — 포맷(LiveFormat) 섹션", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("새 라이브 생성 → 포맷 추가·편집·삭제", async ({ page }) => {
    // 1. 새 라이브 생성.
    await page.goto("/admin/lives/new");
    await page.fill('input[name="titleKo"]', VALID_INPUT.titleKo);
    await page.fill('input[name="titleJp"]', VALID_INPUT.titleJp);
    await page.fill('input[name="titleEn"]', VALID_INPUT.titleEn);

    const typeRadio = page.locator('input[name="type"][value="SOLO"]');
    const typeSelect = page.locator('select[name="type"]');
    if ((await typeRadio.count()) > 0) {
      await typeRadio.check();
    } else if ((await typeSelect.count()) > 0) {
      await typeSelect.selectOption("SOLO");
    }
    await page.fill('input[name="startAtJst"]', VALID_INPUT.startAtJst);
    await page.fill('input[name="venueName"]', VALID_INPUT.venueName);

    await page.getByRole("button", { name: /저장|등록/ }).click();
    await page.waitForURL(/\/admin\/lives\/\d+$/);

    // 2. 포맷 섹션 노출 확인. 기본 LIVE_VENUE 가 자동 생성됨.
    await expect(page.getByRole("heading", { name: /포맷/ })).toBeVisible();

    // 3. + 포맷 추가 → LIVE_VIEWING.
    await page.getByRole("button", { name: /포맷 추가/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/타입/).selectOption("LIVE_VIEWING");
    await page.getByLabel(/라벨/).fill("전국 5관 LV");
    await page.getByRole("button", { name: /^추가$/ }).click();

    // 다이얼로그 닫히고 카드에 노출.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("전국 5관 LV")).toBeVisible();

    // 4. 편집 → 라벨 변경.
    //    라이브뷰잉 카드 한정 편집 버튼을 클릭.
    const viewingCard = page
      .locator('[data-testid="live-format-card"]')
      .filter({ hasText: "라이브뷰잉" });
    await viewingCard.getByRole("button", { name: "편집" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const labelInput = page.getByLabel(/라벨/);
    await labelInput.fill("");
    await labelInput.fill("전국 5관 LV (수정)");
    await page.getByRole("button", { name: /^저장$/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("전국 5관 LV (수정)")).toBeVisible();

    // 5. 삭제 (2단계 confirm).
    const updatedCard = page
      .locator('[data-testid="live-format-card"]')
      .filter({ hasText: "라이브뷰잉" });
    await updatedCard.getByRole("button", { name: "삭제" }).click();
    await expect(
      page.getByText(/연결된 티어\/판매 라운드도 함께 사라집니다/)
    ).toBeVisible();
    await updatedCard.getByRole("button", { name: "삭제 확정" }).click();

    await expect(page.getByText("전국 5관 LV (수정)")).toBeHidden();
  });
});
