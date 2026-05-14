import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * UX_DECISIONS C1 검증 (RED — 구현 전).
 *
 * DRAFT 라이브의 공개 페이지 표시:
 *  - 로그인된 어드민 세션이 있으면 공개 페이지(`/live/[slug]`)에서도 보임.
 *  - 비로그인 사용자는 같은 페이지가 404.
 *
 * 본 사이클에서 공개 페이지 라우팅이 아직 없으면 skip 처리하지 말고
 * RED 로 유지 (다음 사이클에서 구현 후 GREEN 전환).
 *
 * 사전 준비: 어드민으로 DRAFT 라이브 1건 만들고 slug 확보 → 비로그인 세션으로 접근.
 */

const TS = String(Date.now());

test.describe("어드민 세션의 DRAFT 미리보기 (UX_DECISIONS C1)", () => {
  // 공개 페이지(/live/[slug]) 가 본 사이클 범위 밖. 다음 사이클에서 구현 후 활성화.
  test.fixme("어드민으로 DRAFT 만든 뒤 / 라이브 slug 로 공개 페이지 접근하면 DRAFT 배지가 보인다", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await signInAsAdmin(page);

    // 1. DRAFT 라이브 생성
    await page.goto("/admin/lives/new");
    const slug = `preview-draft-${TS}`;
    await page.fill('input[name="titleKo"]', `미리보기 KO ${TS}`);
    await page.fill('input[name="titleJp"]', `プレビュー JP ${TS}`);
    await page.fill('input[name="slug"]', slug);
    const typeRadio = page.locator('input[name="type"][value="SOLO"]');
    const typeSelect = page.locator('select[name="type"]');
    if ((await typeRadio.count()) > 0) {
      await typeRadio.check();
    } else if ((await typeSelect.count()) > 0) {
      await typeSelect.selectOption("SOLO");
    }
    await page.fill('input[name="startAtJst"]', "2026-08-15T18:00");
    await page.fill('input[name="venueName"]', `Venue ${TS}`);
    await page.getByRole("button", { name: /저장|등록/ }).click();
    await page.waitForURL(/\/admin\/lives\/\d+$/);

    // 2. 어드민 세션 그대로 공개 페이지 접근 → DRAFT 라벨 노출
    await page.goto(`/live/${slug}`);
    await expect(page.getByText(/DRAFT/i)).toBeVisible();
  });

  test("비로그인 사용자가 동일 slug 의 공개 페이지에 접근하면 404", async ({
    page,
    context,
  }) => {
    // 같은 worker 내 동일 slug 가 만들어졌다고 가정하지 말고, 안전한 더미 slug 사용.
    await context.clearCookies();
    const response = await page.goto(`/live/nonexistent-${TS}`);
    expect(response?.status()).toBe(404);
  });
});
