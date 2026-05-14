import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { signInAsAdmin } from "../../test/helpers/auth";

/**
 * 어드민 판매 라운드 (TicketSale) E2E.
 *
 * 시나리오:
 *   1. 사전 시드: 라이브 + 포맷 + 티어 + 발매처
 *   2. 어드민 로그인 → /admin/lives/[id] 진입
 *   3. "+ 라운드 추가" → FC 선행 / 추첨 + 일정 + 티어 매핑 → 저장
 *   4. 카드가 노출되는지 확인 (배지/라벨/티어 chip)
 *   5. 편집으로 라벨 변경 → 다시 카드 확인
 *   6. 삭제 → 카드 사라짐
 *
 * 비고:
 *  - Group 6 가 page.tsx 에 TicketSalesSection 를 wiring 하기 전에는
 *    실제 UI 가 없으므로 본 스펙은 `test.fixme` 로 표시.
 *  - Group 6 머지 후 fixme 를 제거해 GREEN 으로 전환.
 */

const TS = String(Date.now());

async function seedLive(): Promise<{ liveId: number; slug: string }> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 비어있다.");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const slug = `e2e-sales-${TS}`;
    const live = await prisma.live.create({
      data: {
        slug,
        titleKo: `E2E 판매 ${TS}`,
        titleJp: `E2E 販売 ${TS}`,
        type: "SOLO",
        // JST 2026-08-15 18:00 = UTC 09:00
        startAt: new Date("2026-08-15T09:00:00Z"),
        venueName: "Saitama Super Arena",
        status: "DRAFT",
      },
    });
    const fmt = await prisma.liveFormat.create({
      data: {
        liveId: live.id,
        type: "LIVE_VENUE",
        venueName: "Saitama Super Arena",
      },
    });
    await prisma.ticketTier.create({
      data: {
        formatId: fmt.id,
        name: "S석",
        priceJpy: 9800,
        order: 0,
      },
    });
    await prisma.vendor.upsert({
      where: { slug: "e-plus" },
      update: {},
      create: {
        slug: "e-plus",
        name: "イープラス",
      },
    });
    return { liveId: live.id, slug };
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("어드민 판매 라운드 — 추가/편집/삭제", () => {
  // Group 6 가 page.tsx 와 LiveEditorShell 을 갱신하기 전에는 UI 미존재.
  test.fixme(
    "라운드 추가 → 카드 표시 → 편집 → 삭제 (옵티미스틱)",
    async ({ page, context }) => {
      await context.clearCookies();
      const { liveId } = await seedLive();
      await signInAsAdmin(page);

      await page.goto(`/admin/lives/${liveId}`);

      // 1. 라운드 추가 버튼
      await page
        .getByRole("button", { name: /\+ 라운드 추가|라운드 추가/ })
        .click();

      // 2. 다이얼로그 폼 채우기
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // vendor 자동 선택 (첫 번째). type/method 도 기본값.
      await dialog
        .getByLabel(/유형/)
        .selectOption({ label: "FC 선행" });
      await dialog
        .getByLabel(/방식/)
        .selectOption({ label: "추첨" });
      await dialog.getByLabel(/라벨/).fill(`E2E FC 最速先行 ${TS}`);
      await dialog.getByLabel(/시작 \(JST\)/).fill("2026-04-01T12:00");
      await dialog.getByLabel(/마감 \(JST\)/).fill("2026-04-10T23:59");

      // tier 연결
      await dialog.getByLabel(/S석/).check();

      await dialog.getByRole("button", { name: /추가/ }).click();
      await expect(dialog).toBeHidden();

      // 3. 카드 노출 (배지 + 라벨 + tier chip)
      const card = page.locator('[data-testid^="ticket-sale-card-"]').first();
      await expect(card).toBeVisible();
      await expect(card).toContainText("FC 선행");
      await expect(card).toContainText("추첨");
      await expect(card).toContainText(`E2E FC 最速先行 ${TS}`);
      await expect(card).toContainText("S석");
      await expect(card).toContainText("¥9,800");

      // 4. 편집 — 라벨 변경
      await card.getByRole("button", { name: "편집" }).click();
      const editDialog = page.getByRole("dialog");
      await editDialog.getByLabel(/라벨/).fill(`수정됨 ${TS}`);
      await editDialog.getByRole("button", { name: /저장/ }).click();
      await expect(editDialog).toBeHidden();
      await expect(card).toContainText(`수정됨 ${TS}`);

      // 5. 삭제 (window.confirm 자동 수락)
      page.once("dialog", (d) => d.accept());
      await card.getByRole("button", { name: "삭제" }).click();
      await expect(card).toBeHidden();
    }
  );
});
