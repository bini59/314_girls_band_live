import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 라이브 티켓 티어 E2E.
 *
 * 시나리오:
 *  1. 새 라이브 등록 → 편집기 진입 (포맷은 자동 생성된 LIVE_VENUE 가 있다고 가정).
 *  2. "티켓 티어" sub-section 에서 + 티어 추가 (S석 지정, 9800).
 *  3. 등급명을 인라인 편집 (자동저장 디바운스 대기).
 *  4. 두 번째 티어 추가 후 ↓ 로 순서 변경.
 *  5. 티어 삭제.
 *
 * 참고:
 *  - Group 6 가 LiveFormatCard 에 `tierSlot` 으로 본 컴포넌트를 연결해야 본 시나리오가
 *    실제로 동작한다. 본 spec 은 그 결합을 검증하는 출구 테스트.
 */

const TS = String(Date.now());

const VALID_INPUT = {
  titleKo: `티어 E2E ${TS}`,
  titleJp: `ティア E2E ${TS}`,
  titleEn: `tier-e2e-${TS}`,
  startAtJst: "2026-09-10T18:00",
  venueName: `Tier Arena ${TS}`,
};

test.describe("어드민 라이브 — 티켓 티어 sub-section", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("티어 추가 → 편집 → 순서 변경 → 삭제", async ({ page }) => {
    // 1. 새 라이브 등록.
    await page.goto("/admin/lives");
    await page.getByRole("link", { name: /새 라이브/ }).click();
    await expect(page).toHaveURL(/\/admin\/lives\/new$/);

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

    // 2. 티어 sub-section 찾기.
    const tierSection = page.getByRole("region", { name: /티켓 티어/ }).first();
    await expect(tierSection).toBeVisible();
    await expect(
      tierSection.getByText(/티어가 아직 없습니다/)
    ).toBeVisible();

    // 3. 티어 추가.
    await tierSection.getByLabel("등급명").first().fill("S석 지정");
    await tierSection.getByLabel("가격(JPY)").first().fill("9800");
    await tierSection.getByRole("button", { name: "+ 티어 추가" }).click();

    // 추가 row 의 등급명 input 확인.
    await expect(
      tierSection.getByDisplayValue("S석 지정")
    ).toBeVisible({ timeout: 5_000 });

    // 4. 두 번째 티어 추가.
    await tierSection.getByLabel("등급명").first().fill("A석");
    await tierSection.getByLabel("가격(JPY)").first().fill("6800");
    await tierSection.getByRole("button", { name: "+ 티어 추가" }).click();
    await expect(tierSection.getByDisplayValue("A석")).toBeVisible({
      timeout: 5_000,
    });

    // 5. 첫 row 이름 인라인 편집 → 자동저장 확인.
    const sRow = tierSection
      .getByDisplayValue("S석 지정")
      .first();
    await sRow.fill("S석 지정 (변경)");
    await page.waitForTimeout(1200);
    await expect(tierSection.getByText(/저장됨/).first()).toBeVisible({
      timeout: 5_000,
    });

    // 6. 첫 row 를 아래로 이동.
    await tierSection
      .getByRole("button", { name: "아래로 이동" })
      .first()
      .click();
    // 잠시 대기 (낙관적 UI + 서버 동기화).
    await page.waitForTimeout(500);

    // 7. 첫 row 삭제.
    page.once("dialog", (dialog) => dialog.accept());
    await tierSection.getByRole("button", { name: "삭제" }).first().click();
    await page.waitForTimeout(500);
  });
});
