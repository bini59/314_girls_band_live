import { test, expect, request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 투어 관리 + Live 연결 + 공개 페이지 + iCal E2E.
 *
 * 시나리오:
 *  1. 사이드바에서 "투어" 메뉴 활성화 확인
 *  2. 작품 생성 → 투어 생성 (status=PUBLISHED)
 *  3. 새 라이브 생성 시 Tour Select 에 방금 만든 투어가 노출
 *  4. 라이브 생성 + 투어 연결 (DB 시드로 LiveBand 게이트 충족 + 공개)
 *  5. 공개 /tours/{slug} 페이지: 회차 카드 표시
 *  6. 공개 /lives/{slug} 페이지: 투어 배지 표시
 *  7. iCal `?tour={slug}` GET 검증: VEVENT 포함
 *  8. 정리
 */

const TS = String(Date.now());

const WORK_SLUG = `e2e-tour-work-${TS}`;
const WORK_NAME_KO = `투어 E2E 작품 ${TS}`;
const TOUR_SLUG = `e2e-tour-${TS}`;
const TOUR_NAME_KO = `투어 E2E ${TS}`;
const TOUR_NAME_JP = `ツアー E2E ${TS}`;
const BAND_SLUG = `e2e-tour-band-${TS}`;
const BAND_NAME_KO = `투어 밴드 E2E ${TS}`;
const LIVE_TITLE_KO = `투어 회차 KO ${TS}`;
const LIVE_TITLE_EN = `e2e-tour-live-${TS}`;

test.describe("어드민 투어 → 공개 페이지 → iCal", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await signInAsAdmin(page);
  });

  test("투어 CRUD + Live 연결 + 공개 페이지 + iCal", async ({ page, baseURL }) => {
    // 1. 사이드바에 "투어" 메뉴 확인
    await page.goto("/admin/lives");
    const nav = page.getByRole("navigation", { name: "어드민 메뉴" });
    await expect(nav.getByRole("link", { name: "투어" })).toBeVisible();

    // 2. 작품 추가
    await page.goto("/admin/works/new");
    await page.getByLabel("slug").fill(WORK_SLUG);
    await page.getByLabel("한국어 이름").fill(WORK_NAME_KO);
    await page.getByLabel("일본어 이름").fill("E2E ワーク");
    await page.getByRole("button", { name: /^저장$/ }).click();
    await expect(page).toHaveURL(/\/admin\/works$/);

    // 3. 투어 추가
    await page.goto("/admin/tours");
    await expect(
      page.getByRole("heading", { name: "투어 관리" })
    ).toBeVisible();
    await page.getByRole("link", { name: /\+ 투어 추가/ }).click();
    await expect(
      page.getByRole("heading", { name: "투어 추가" })
    ).toBeVisible();

    await page
      .getByLabel("작품")
      .selectOption({ label: new RegExp(WORK_NAME_KO) });
    await page.getByLabel("slug").fill(TOUR_SLUG);
    await page.getByLabel("한국어 이름").fill(TOUR_NAME_KO);
    await page.getByLabel("일본어 이름").fill(TOUR_NAME_JP);
    await page.getByLabel("상태").selectOption("PUBLISHED");
    await page.getByRole("button", { name: /^저장$/ }).click();

    await expect(page).toHaveURL(/\/admin\/tours$/);
    await expect(page.getByText(TOUR_NAME_KO)).toBeVisible();

    // 4. 라이브 신규 폼에서 Tour Select 에 노출되는지 확인 + 선택 + 저장
    await page.goto("/admin/lives/new");
    const tourSelect = page.locator('select[name="tourId"]');
    await expect(tourSelect).toBeVisible();
    await tourSelect.selectOption({
      label: new RegExp(TOUR_NAME_KO),
    });

    await page.fill('input[name="titleKo"]', LIVE_TITLE_KO);
    await page.fill('input[name="titleJp"]', `ライブ ${TS}`);
    await page.fill('input[name="titleEn"]', LIVE_TITLE_EN);
    await page.locator('select[name="type"]').selectOption("SOLO");
    await page.fill('input[name="startAtJst"]', "2026-08-20T18:30");
    await page.fill('input[name="venueName"]', `Tour Venue ${TS}`);
    await page.getByRole("button", { name: /^저장$/ }).click();

    // 편집기로 이동 — liveId 추출
    await page.waitForURL(/\/admin\/lives\/\d+$/);
    const liveIdMatch = page.url().match(/\/admin\/lives\/(\d+)$/);
    if (!liveIdMatch) throw new Error("liveId 파싱 실패");
    const liveId = Number(liveIdMatch[1]);

    // 5. LiveBand 시드 + 공개 (게이트 충족용)
    const prisma = new PrismaClient();
    try {
      // 작품/투어 id 조회.
      const work = await prisma.work.findUnique({ where: { slug: WORK_SLUG } });
      const tour = await prisma.tour.findUnique({ where: { slug: TOUR_SLUG } });
      if (!work || !tour) throw new Error("작품/투어 seed 조회 실패");

      // 밴드 시드 + LiveBand 시드.
      const band = await prisma.band.upsert({
        where: { slug: BAND_SLUG },
        update: {},
        create: {
          slug: BAND_SLUG,
          nameKo: BAND_NAME_KO,
          nameJp: "투어 밴드 JP",
          workId: work.id,
        },
      });
      await prisma.liveBand.upsert({
        where: { liveId_bandId: { liveId, bandId: band.id } },
        update: {},
        create: { liveId, bandId: band.id, isHeadliner: true, order: 0 },
      });
      // 라이브 공개 처리 (UI 게이트 우회).
      await prisma.live.update({
        where: { id: liveId },
        data: { status: "PUBLISHED" },
      });

      // tourId 가 실제로 들어갔는지 확인.
      const live = await prisma.live.findUnique({ where: { id: liveId } });
      expect(live?.tourId).toBe(tour.id);

      // 6. 공개 /tours/{slug} 페이지 — 회차 카드 표시
      await page.goto(`/tours/${TOUR_SLUG}`);
      await expect(
        page.getByRole("heading", { name: TOUR_NAME_KO })
      ).toBeVisible();
      await expect(page.getByText(LIVE_TITLE_KO)).toBeVisible();

      // 7. 공개 /lives/{slug} 페이지 — 투어 배지
      const liveSlug = live!.slug;
      await page.goto(`/lives/${liveSlug}`);
      await expect(page.getByText(new RegExp(`투어 · ${TOUR_NAME_KO}`))).toBeVisible();

      // 8. iCal ?tour= 응답 검증
      const apiContext = await request.newContext({ baseURL });
      const ical = await apiContext.get(
        `/api/calendar?tour=${encodeURIComponent(TOUR_SLUG)}`
      );
      expect(ical.status()).toBe(200);
      const body = await ical.text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("BEGIN:VEVENT");
      expect(body).toContain(`UID:live-${liveSlug}@`);
      expect(body).toContain(`X-WR-CALDESC:투어: ${TOUR_SLUG}`);
      await apiContext.dispose();
    } finally {
      // 9. 정리 — 자식부터 삭제.
      await prisma.liveBand.deleteMany({ where: { liveId } });
      await prisma.live.deleteMany({ where: { id: liveId } });
      await prisma.tour.deleteMany({ where: { slug: TOUR_SLUG } });
      await prisma.band.deleteMany({ where: { slug: BAND_SLUG } });
      await prisma.work.deleteMany({ where: { slug: WORK_SLUG } });
      await prisma.$disconnect();
    }
  });
});
