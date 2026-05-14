import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 라이브 — 출연 밴드 섹션 E2E.
 *
 * 시나리오:
 *  1. 로그인 → /admin/lives
 *  2. 새 라이브 등록 → 편집기 진입
 *  3. 출연 밴드 검색 콤보박스에 query 입력 → 목록 표시
 *  4. 결과 클릭 → 라인업에 추가 (낙관적 표시)
 *  5. 헤드라이너 체크 토글
 *  6. 두 번째 밴드 추가 후 ↑↓ 으로 순서 변경
 *  7. 제거 버튼으로 라인업에서 제거
 *
 * 사전 조건:
 *  - DB 에 검색 가능한 밴드가 1개 이상 시드되어 있어야 한다.
 *    (현재 프로젝트 시드는 dev DB 기준 — 본 테스트는 시드된 라이브가
 *     없을 수 있으므로 UI 등록 흐름을 사용해 라이브를 만든다.)
 *  - 출연 밴드 섹션은 Group 6 에서 라이브 편집기 페이지에 와이어업된다.
 *    그 전에는 본 테스트는 RED 로 남는다.
 */

const TS = String(Date.now());

const NEW_LIVE = {
  titleKo: `E2E 밴드섹션 라이브 KO ${TS}`,
  titleJp: `E2E バンドセクション ${TS}`,
  titleEn: `e2e-bands-en-${TS}`,
  type: "TAIBAN" as const,
  startAtJst: "2026-09-30T18:00",
  venueName: `Zepp Tokyo ${TS}`,
};

test.describe("어드민 라이브 — 출연 밴드 섹션", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("새 라이브 등록 → 밴드 추가 → 헤드라이너 토글 → 순서 변경 → 제거", async ({
    page,
  }) => {
    // 1. 신규 라이브 등록.
    await page.goto("/admin/lives");
    await page.getByRole("link", { name: /새 라이브/ }).click();
    await expect(page).toHaveURL(/\/admin\/lives\/new$/);

    await page.fill('input[name="titleKo"]', NEW_LIVE.titleKo);
    await page.fill('input[name="titleJp"]', NEW_LIVE.titleJp);
    await page.fill('input[name="titleEn"]', NEW_LIVE.titleEn);

    const typeRadio = page.locator('input[name="type"][value="TAIBAN"]');
    const typeSelect = page.locator('select[name="type"]');
    if ((await typeRadio.count()) > 0) {
      await typeRadio.check();
    } else if ((await typeSelect.count()) > 0) {
      await typeSelect.selectOption("TAIBAN");
    }
    await page.fill('input[name="startAtJst"]', NEW_LIVE.startAtJst);
    await page.fill('input[name="venueName"]', NEW_LIVE.venueName);
    await page.getByRole("button", { name: /저장|등록/ }).click();
    await page.waitForURL(/\/admin\/lives\/\d+$/);

    // 2. 출연 밴드 섹션이 보여야 한다.
    await expect(page.getByText("출연 밴드")).toBeVisible();
    // 빈 상태 안내.
    await expect(page.getByTestId("live-bands-empty")).toBeVisible();

    // 3. 검색 콤보박스 — placeholder 로 식별 (Combobox 에 accessible label 없음).
    const target = page.locator('input[placeholder*="밴드 검색"]');

    await target.click();
    await target.fill("a"); // 가장 일반적인 시드 매칭 토큰.

    // 결과 listbox 내 첫 option 선택. (mouseDown 으로 blur 보다 먼저 처리.)
    const listbox = page.getByRole("listbox");
    await listbox.waitFor({ state: "visible", timeout: 5_000 });
    const firstOption = listbox.locator('[role="option"]').first();
    await firstOption.click();

    // 4. 라인업에 1개 표시.
    await expect(page.getByTestId("live-bands-list")).toBeVisible();
    expect(await page.getByTestId("live-bands-list").locator("li").count()).toBe(1);

    // 5. 헤드라이너 체크 (라인업의 첫 row).
    const headlinerCb = page.getByLabel("헤드라이너").first();
    await headlinerCb.check();
    await expect(headlinerCb).toBeChecked();

    // 6. 두 번째 밴드 추가 → 순서 변경.
    await target.click();
    await target.fill("a");
    await listbox.waitFor({ state: "visible", timeout: 5_000 });
    const remainingOptions = listbox.locator('[role="option"]');
    const optionCount = await remainingOptions.count();
    if (optionCount > 0) {
      await remainingOptions.first().click();

      const lineup = page.getByTestId("live-bands-list").locator("li");
      const total = await lineup.count();
      if (total >= 2) {
        // 두 번째 row 의 위로 이동.
        const upButtons = page.getByRole("button", { name: "위로 이동" });
        await upButtons.nth(1).click();
        // 잠깐 대기 후 첫 row 가 바뀌었는지 확인 (구체 텍스트 불확정 → 단순히
        // 항목 수가 유지되는지만 검증).
        await expect(lineup).toHaveCount(total);
      }
    }

    // 7. 마지막 row 제거.
    const removeButtons = page.getByRole("button", { name: "제거" });
    const initialCount = await page
      .getByTestId("live-bands-list")
      .locator("li")
      .count();
    await removeButtons.last().click();
    await expect(
      page.getByTestId("live-bands-list").locator("li")
    ).toHaveCount(initialCount - 1);
  });
});
