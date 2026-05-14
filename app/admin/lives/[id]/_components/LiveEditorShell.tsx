import Link from "next/link";
import type { Band, Live, LiveBand, LiveFormat, TicketTier, Vendor } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

import { LiveHeaderSection } from "./LiveHeaderSection";
import { PublishGate } from "./PublishGate";
import { LiveBandsSection } from "./LiveBandsSection";
import { LiveFormatsSection } from "./LiveFormatsSection";
import { TicketSalesSection } from "./TicketSalesSection";

import type { TierMultiSelectFormat } from "./TierMultiSelect";
import type { SerializedTicketSale } from "../ticket-sale-actions";
import type { listTicketSales } from "@/lib/ticket-sale/repo";

/**
 * 라이브 편집기 셸 (Group 6 wire-up).
 *
 * 섹션:
 *  - 헤더 (자동저장)
 *  - 출연 밴드 (검색→추가→순서→삭제)
 *  - 포맷 (실황/LV/배포) — 각 포맷 카드 안에 티어 nested
 *  - 판매 라운드 (선행/일반/추첨/선착)
 *  - 우측 (lg+): 공개 게이트
 *
 * 데이터는 page.tsx 에서 한 번에 fetch → 각 섹션 컴포넌트는 자기 mutation
 * 후 revalidatePath 로 server fetch 를 재실행시켜 최신 상태를 받는다.
 */
type LiveBandRow = LiveBand & { band: Band };
type LiveFormatRow = LiveFormat & { tiers: TicketTier[] };

export interface LiveEditorShellProps {
  live: Live;
  liveBands: LiveBandRow[];
  liveFormats: LiveFormatRow[];
  ticketSales: SerializedTicketSaleRow[];
  vendors: Vendor[];
}

/**
 * `listTicketSales` 가 반환하는 row 는 Date 객체. SerializedTicketSale
 * (액션 응답 형태) 와 호환되도록 본 컴포넌트에서 ISO 문자열로 직렬화.
 */
type SerializedTicketSaleRow = Awaited<ReturnType<typeof listTicketSales>>[number];

function serializeSale(row: SerializedTicketSaleRow): SerializedTicketSale {
  return {
    id: row.id,
    liveId: row.liveId,
    vendorId: row.vendorId,
    vendor: {
      id: row.vendor.id,
      name: row.vendor.name,
      slug: row.vendor.slug,
    },
    type: row.type,
    method: row.method,
    label: row.label ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    announceAt: row.announceAt ? row.announceAt.toISOString() : null,
    paymentDeadlineAt: row.paymentDeadlineAt
      ? row.paymentDeadlineAt.toISOString()
      : null,
    url: row.url ?? null,
    notes: row.notes ?? null,
    tiers: row.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      priceJpy: t.priceJpy,
      formatId: t.formatId,
    })),
  };
}

export function LiveEditorShell({
  live,
  liveBands,
  liveFormats,
  ticketSales,
  vendors,
}: LiveEditorShellProps) {
  // 출연 밴드 → LiveBandsSectionItem 형태로 변환.
  const initialBands = liveBands.map((lb) => ({
    bandId: lb.bandId,
    isHeadliner: lb.isHeadliner,
    order: lb.order,
    band: { nameKo: lb.band.nameKo, nameJp: lb.band.nameJp },
  }));

  // 포맷 → LiveFormatLike 형태 (tiers 포함 — LiveFormatCard 가 nested 렌더).
  const initialFormats = liveFormats.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    venueName: f.venueName,
    url: f.url,
    tiers: f.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      priceJpy: t.priceJpy,
      order: t.order,
      notes: t.notes,
    })),
  }));

  // TicketSaleDialog 의 TierMultiSelect 후보 형태.
  const tierMultiSelectFormats: TierMultiSelectFormat[] = liveFormats.map(
    (f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      venueName: f.venueName,
      tiers: f.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        priceJpy: t.priceJpy,
      })),
    })
  );

  const initialSales = ticketSales.map(serializeSale);

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-2">
        <Link
          href="/admin/lives"
          className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
        >
          ← 목록으로
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{live.titleKo}</h1>
          <Badge
            variant={live.status === "PUBLISHED" ? "success" : "secondary"}
          >
            {live.status}
          </Badge>
        </div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          /lives/{live.slug}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-6">
          <LiveHeaderSection live={live} />

          <LiveBandsSection
            liveId={live.id}
            initialBands={initialBands}
          />

          <LiveFormatsSection
            liveId={live.id}
            initialFormats={initialFormats}
          />

          <TicketSalesSection
            liveId={live.id}
            initialSales={initialSales}
            vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
            formats={tierMultiSelectFormats}
          />
        </div>

        <PublishGate live={live} />
      </div>
    </div>
  );
}

