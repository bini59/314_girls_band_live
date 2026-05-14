import { notFound } from "next/navigation";

import { getLiveById } from "@/lib/live/repo";
import { listLiveBands } from "@/lib/live-band/repo";
import { listLiveFormats } from "@/lib/live-format/repo";
import { listTicketSales } from "@/lib/ticket-sale/repo";
import { listVendors } from "@/lib/vendors/repo";

import { LiveEditorShell } from "./_components/LiveEditorShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "라이브 편집 — 걸즈밴드 라이브",
};

/**
 * 라이브 편집 페이지.
 *
 * 한 번의 페이지 fetch 에서 nested 데이터까지 모두 가져온다:
 *  - Live (헤더)
 *  - LiveBand (출연 밴드)
 *  - LiveFormat (포맷 + 티어 nested)
 *  - TicketSale (판매 라운드 + vendor + tier 링크)
 *  - Vendor (라운드 다이얼로그 의 발매처 셀렉트)
 *
 * 각 섹션은 자기 자신의 mutation 후 `revalidatePath('/admin/lives/{id}')`
 * 를 호출하므로 Next.js 가 server fetch 를 재실행한다.
 */
export default async function LiveEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isFinite(liveId) || liveId <= 0) {
    notFound();
  }

  const live = await getLiveById(liveId);
  if (!live) {
    notFound();
  }

  const [liveBands, liveFormats, ticketSales, vendors] = await Promise.all([
    listLiveBands(liveId),
    listLiveFormats(liveId),
    listTicketSales(liveId),
    listVendors(),
  ]);

  return (
    <LiveEditorShell
      live={live}
      liveBands={liveBands}
      liveFormats={liveFormats}
      ticketSales={ticketSales}
      vendors={vendors}
    />
  );
}
