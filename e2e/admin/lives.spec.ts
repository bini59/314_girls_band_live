import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 라이브 헤더 등록·편집·공개 E2E.
 *
 * 시나리오:
 *   1. 빈 목록 진입
 *   2. + 새 라이브 → 헤더 등록 → 편집기로 redirect
 *   3. 편집기에서 자동저장 (800ms 디바운스)
 *   4. LiveBand seed (게이트 충족용) → 공개 / 비공개 토글
 *   5. 목록으로 돌아가 표시 확인
 *   6. 로그아웃
 *
 * 가정:
 *  - DRAFT 라이브도 어드민 세션에서는 공개 페이지에서 보임 (UX_DECISIONS C1).
 *  - 공개 게이트는 헤더 필수 필드 + LiveBand >= 1. UI 가 없는 LiveBand 는 DB 시드.
 */

const TS = String(Date.now());

const VALID_INPUT = {
  titleKo: `E2E 라이브 KO ${TS}`,
  titleJp: `E2E ライブ JP ${TS}`,
  titleEn: `e2e-live-en-${TS}`,
  type: "SOLO",
  // 미래 시각 (테스트 실행 시점에 무관하게 안전)
  startAtJst: "2026-08-15T18:00",
  venueName: `Saitama Super Arena ${TS}`,
};

test.describe("어드민 라이브 관리 — 헤더 등록·편집·공개", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("빈 목록 화면 표시 (라이브가 없습니다 안내 + 새 라이브 버튼)", async ({
    page,
  }) => {
    await page.goto("/admin/lives");
    await expect(page).toHaveURL(/\/admin\/lives$/);

    // 빈 상태 안내
    await expect(page.getByText(/라이브가 없습니다|아직 라이브가 없습니다/)).toBeVisible();

    // "새 라이브" 버튼 (텍스트는 + 새 라이브 또는 "새 라이브 추가" 등 — 구현부와 합의)
    await expect(page.getByRole("link", { name: /새 라이브/ })).toBeVisible();
  });

  test("새 라이브 등록 → 편집기 진입 → 자동저장 → 공개 → 목록 표시", async ({
    page,
  }) => {
    // 1. 목록 진입
    await page.goto("/admin/lives");

    // 2. 새 라이브 버튼 클릭 → /admin/lives/new
    await page.getByRole("link", { name: /새 라이브/ }).click();
    await expect(page).toHaveURL(/\/admin\/lives\/new$/);

    // 3. 필수 필드 빈 채 제출 → 에러
    await page.getByRole("button", { name: /저장|등록/ }).click();
    await expect(page).toHaveURL(/\/admin\/lives\/new$/); // 그대로 머묾

    // 4. 필수 필드 채워서 제출
    await page.fill('input[name="titleKo"]', VALID_INPUT.titleKo);
    await page.fill('input[name="titleJp"]', VALID_INPUT.titleJp);
    await page.fill('input[name="titleEn"]', VALID_INPUT.titleEn);
    // type: SOLO (라디오 또는 select)
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

    // 5. 편집기로 redirect (`/admin/lives/{id}`)
    await page.waitForURL(/\/admin\/lives\/\d+$/);

    // 6. DRAFT 배지 표시
    await expect(page.getByText(/DRAFT/i)).toBeVisible();

    // 7. titleEn 변경 → 800ms 후 "저장됨" 인디케이터
    const titleEnInput = page.locator('input[name="titleEn"]');
    if ((await titleEnInput.count()) > 0) {
      await titleEnInput.fill(`${VALID_INPUT.titleEn}-edited`);
      // 800ms 디바운스 + 약간의 여유
      await page.waitForTimeout(1200);
      // 저장 상태 인디케이터 — "저장됨" 또는 "모두 저장됨"
      await expect(page.getByText(/저장됨|saved/i)).toBeVisible({
        timeout: 5_000,
      });
    }

    // 8. 게이트 충족 — LiveBand 1건을 DB 에 직접 시드.
    //    (LiveBand 관리 UI 는 다음 사이클까지 placeholder)
    const liveIdMatch = page.url().match(/\/admin\/lives\/(\d+)$/);
    if (!liveIdMatch) {
      throw new Error("편집기 URL 에서 liveId 를 파싱하지 못함");
    }
    const liveId = Number(liveIdMatch[1]);
    const prisma = new PrismaClient();
    try {
      const work = await prisma.work.upsert({
        where: { slug: `e2e-work-${TS}` },
        update: {},
        create: {
          slug: `e2e-work-${TS}`,
          nameKo: "E2E 작품",
          nameJp: "E2E Work",
        },
      });
      const band = await prisma.band.upsert({
        where: { slug: `e2e-band-${TS}` },
        update: {},
        create: {
          slug: `e2e-band-${TS}`,
          nameKo: "E2E 밴드",
          nameJp: "E2E Band",
          workId: work.id,
        },
      });
      await prisma.liveBand.upsert({
        where: { liveId_bandId: { liveId, bandId: band.id } },
        update: {},
        create: { liveId, bandId: band.id, isHeadliner: false, order: 0 },
      });
    } finally {
      await prisma.$disconnect();
    }

    // page reload — 서버 컴포넌트가 최신 liveBand 카운트를 보도록.
    await page.reload();

    // 공개 버튼 클릭 → PUBLISHED 표시
    await page.getByRole("button", { name: /^공개$/ }).click();
    await expect(page.getByText(/PUBLISHED/i)).toBeVisible();

    // 9. 비공개 토글
    await page.getByRole("button", { name: /비공개|unpublish|DRAFT 로/i }).click();
    await expect(page.getByText(/DRAFT/i)).toBeVisible();

    // 10. 목록으로 돌아가 새 라이브가 보이는지
    await page.goto("/admin/lives");
    await expect(page.getByText(VALID_INPUT.titleKo)).toBeVisible();
  });

  test("로그아웃 → /admin/login 으로 이동 + 재접근 시 redirect", async ({
    page,
    context,
  }) => {
    await page.goto("/admin/lives");

    // TopBar 의 로그아웃 버튼
    await page.getByRole("button", { name: /로그아웃|sign\s*out/i }).click();

    await expect(page).toHaveURL(/\/admin\/login/);

    // 쿠키가 삭제되어 /admin/lives 재접근 시 다시 login 으로 튕김
    await page.goto("/admin/lives");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
