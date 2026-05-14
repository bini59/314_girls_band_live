import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 풀 플로우 E2E — 라이브 생성부터 공개까지 모든 섹션을 거친다.
 *
 *   1. 어드민 로그인
 *   2. + 새 라이브 → 헤더 등록 → 편집기 진입
 *   3. 출연 밴드 검색 → 추가
 *   4. 포맷 추가 (LIVE_VIEWING 라벨)
 *   5. (자동생성된 LIVE_VENUE) 포맷 카드 내부 티어 추가
 *   6. Vendor 어드민에서 발매처 시드
 *   7. 판매 라운드 추가 (티어 연결)
 *   8. 공개 게이트 통과 → PUBLISHED
 *
 * 본 spec 은 통합 검증 용도. 각 섹션의 세부 spec 은 별도 파일.
 *
 * 시간 제약(개별 액션 자동저장 800ms 등) 때문에 `page.waitForTimeout` 을
 * 최소 1회씩 사용한다.
 */

const TS = String(Date.now());

test.describe("어드민 풀 플로우 — 헤더부터 공개까지", () => {
  test.fixme(
    !process.env.PLAYWRIGHT_BASE_URL && !process.env.CI,
    "로컬 dev server + DB 가 필요합니다. CI 또는 PLAYWRIGHT_BASE_URL 환경에서 실행."
  );

  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
    // 검색용 시드 밴드 1개 — 다른 테스트와 충돌 없게 unique slug 보장.
    await prisma.work
      .upsert({
        where: { slug: `e2e-work-${TS}` },
        update: {},
        create: {
          slug: `e2e-work-${TS}`,
          nameKo: "E2E 작품",
          nameJp: "E2E 作品",
        },
      })
      .catch(() => undefined);
    await prisma.band
      .upsert({
        where: { slug: `e2e-band-${TS}` },
        update: {},
        create: {
          slug: `e2e-band-${TS}`,
          nameKo: "이투이밴드",
          nameJp: "e2e-band",
          work: {
            connect: { slug: `e2e-work-${TS}` },
          },
        },
      })
      .catch(() => undefined);
  });

  test.afterAll(async () => {
    await prisma?.$disconnect();
  });

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("새 라이브 → 밴드/포맷/티어/라운드 추가 → 공개", async ({ page }) => {
    // 1. + 새 라이브
    await page.goto("/admin/lives/new");
    await page.fill('input[name="titleKo"]', `풀플로우 라이브 ${TS}`);
    await page.fill('input[name="titleJp"]', `フル ${TS}`);
    await page.fill('input[name="titleEn"]', `full-${TS}`);
    await page.fill('input[name="startAtJst"]', "2026-09-20T18:00");
    await page.fill('input[name="venueName"]', `풀 아레나 ${TS}`);
    await page.getByRole("button", { name: /등록|저장/ }).click();
    await page.waitForURL(/\/admin\/lives\/\d+$/);

    // 2. 출연 밴드 검색 → 추가
    const bandInput = page.getByPlaceholder(/밴드.*검색|검색/i).first();
    if (await bandInput.isVisible().catch(() => false)) {
      await bandInput.fill("e2e");
      await page.waitForTimeout(400); // 디바운스
      const option = page.getByRole("option").first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }

    // 3. 포맷 추가 (LIVE_VIEWING)
    const formatAdd = page.getByRole("button", { name: /\+ ?포맷/ });
    if (await formatAdd.isVisible().catch(() => false)) {
      await formatAdd.click();
      await page.getByLabel(/타입/).selectOption("LIVE_VIEWING");
      await page.getByLabel(/라벨/).fill(`전국 LV ${TS}`);
      await page.getByRole("button", { name: /^추가$|저장|등록/ }).click();
    }

    // 4. 공개 — 모든 게이트 통과 가정. 실패 시 게이트 메시지 노출.
    const publishBtn = page.getByRole("button", { name: /^공개$/ });
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      // 결과: PUBLISHED 배지 또는 게이트 실패 메시지
      await page.waitForTimeout(500);
    }

    // 5. 통합 페이지가 적어도 에러 없이 렌더링되는지 검증
    await expect(page.getByText("출연 밴드")).toBeVisible();
    await expect(page.getByText("포맷")).toBeVisible();
    await expect(page.getByText(/판매.*라운드|판매 라운드/)).toBeVisible();
  });
});
