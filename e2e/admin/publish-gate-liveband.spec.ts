import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 라이브 공개 게이트 — LiveBand >= 1 검증 E2E.
 *
 * 시나리오:
 *   1. 헤더 필수 필드 충족 + LiveBand 0건 상태의 라이브를 seed.
 *   2. 로그인 → 편집 페이지 진입.
 *   3. 공개 버튼 클릭 → "부족한 항목 / 출연 밴드" 게이트 안내 노출.
 *   4. DB 에 LiveBand 1건 추가 → 페이지 reload → 공개 → PUBLISHED 배지 노출.
 *
 * 본 사이클은 LiveBand UI 가 placeholder 이므로 DB 시드로 우회한다.
 */

const TS = String(Date.now());
const LIVE_SLUG = `gate-test-live-${TS}`;
const BAND_SLUG = `gate-test-band-${TS}`;
const WORK_SLUG = `gate-test-work-${TS}`;

let prisma: PrismaClient;

test.beforeAll(() => {
  prisma = new PrismaClient();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("공개 게이트 — LiveBand", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("LiveBand 0건 → 게이트 실패 (출연 밴드 안내), 추가 후 → PUBLISHED", async ({
    page,
  }) => {
    // 1. seed — 헤더 충족 + LiveBand 0건 라이브
    const live = await prisma.live.create({
      data: {
        slug: LIVE_SLUG,
        titleKo: `게이트 라이브 KO ${TS}`,
        titleJp: `ゲート ライブ JP ${TS}`,
        titleEn: null,
        type: "SOLO",
        startAt: new Date("2026-09-01T09:00:00Z"),
        venueName: `Seed Hall ${TS}`,
        status: "DRAFT",
      },
    });

    try {
      // 2. 편집 페이지 진입
      await page.goto(`/admin/lives/${live.id}`);
      await expect(page).toHaveURL(new RegExp(`/admin/lives/${live.id}$`));

      // 3. 공개 시도 → 게이트 실패
      await page.getByRole("button", { name: /^공개$/ }).click();
      await expect(page.getByText(/부족한 항목/)).toBeVisible();
      await expect(page.getByText("출연 밴드")).toBeVisible();

      // 상태가 DRAFT 그대로
      await expect(page.getByText(/DRAFT/i)).toBeVisible();

      // 4. LiveBand 시드 후 재시도
      const work = await prisma.work.create({
        data: {
          slug: WORK_SLUG,
          nameKo: "게이트 작품",
          nameJp: "Gate Work",
        },
      });
      const band = await prisma.band.create({
        data: {
          slug: BAND_SLUG,
          nameKo: "게이트 밴드",
          nameJp: "Gate Band",
          workId: work.id,
        },
      });
      await prisma.liveBand.create({
        data: {
          liveId: live.id,
          bandId: band.id,
          isHeadliner: false,
          order: 0,
        },
      });

      // 페이지 reload — 클라이언트 상태 초기화.
      await page.reload();

      // 공개 재시도 → 성공
      await page.getByRole("button", { name: /^공개$/ }).click();
      await expect(page.getByText(/PUBLISHED/i)).toBeVisible();
    } finally {
      // cleanup
      await prisma.liveBand.deleteMany({ where: { liveId: live.id } });
      await prisma.live.deleteMany({ where: { id: live.id } });
      await prisma.band.deleteMany({ where: { slug: BAND_SLUG } });
      await prisma.work.deleteMany({ where: { slug: WORK_SLUG } });
    }
  });
});
