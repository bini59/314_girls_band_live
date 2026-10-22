/**
 * TicketSale 도메인 DB I/O 단일 진입점.
 *
 * 일본 티켓팅의 "라운드" 단위. FC 선행 / 공식 선행 / 플레이가이드 / 일반 / 추첨 / 선착 등.
 *  - 한 라운드는 N 개 티어를 다룬다 (TicketSaleTier 조인).
 *  - 트랜잭션: createTicketSale + setTicketSaleTiers 는 모두 atomic.
 *  - cross-live 가드: tierIds 는 반드시 해당 liveId 의 format 에 속해야 한다.
 *  - getSaleLiveId: action 레이어 권한 검사용.
 */
import type {
  Prisma,
  TicketSale,
  TicketSaleMethod,
  TicketSaleType,
  TicketTier,
  Vendor,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/db";
import { atomicBatch, statement } from "@/lib/d1";

export type TicketSaleWithRelations = TicketSale & {
  vendor: Vendor;
  tiers: TicketTier[];
};

/**
 * 라이브의 모든 TicketSale 라운드.
 *  - vendor + tiers (flatten) include.
 *  - 정렬: startsAt asc, id asc.
 */
export async function listTicketSales(
  liveId: number,
): Promise<TicketSaleWithRelations[]> {
  const rows = await prisma.ticketSale.findMany({
    where: { liveId },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    include: {
      vendor: true,
      tiers: { include: { tier: true } },
    },
  });

  // TicketSaleTier 조인을 flatten 하여 TicketTier[] 로 노출.
  return rows.map((row) => {
    const { tiers, ...rest } = row;
    return {
      ...rest,
      tiers: tiers.map((t) => t.tier),
    };
  });
}

export type CreateTicketSaleInput = {
  liveId: number;
  vendorId: number;
  type: TicketSaleType;
  method: TicketSaleMethod;
  label?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  announceAt?: Date | null;
  paymentDeadlineAt?: Date | null;
  url?: string | null;
  notes?: string | null;
  tierIds: number[];
};

/** Validate ownership first, then atomically insert the sale and all tier links in D1. */
export async function createTicketSale(
  input: CreateTicketSaleInput,
): Promise<TicketSaleWithRelations> {
  await validateTiers(input.liveId, input.tierIds);
  const now = new Date();
  const columns = [
    "live_id",
    "vendor_id",
    "type",
    "method",
    "label",
    "starts_at",
    "ends_at",
    "announce_at",
    "payment_deadline_at",
    "url",
    "notes",
    "created_at",
    "updated_at",
  ];
  const values = [
    input.liveId,
    input.vendorId,
    input.type,
    input.method,
    input.label ?? null,
    input.startsAt,
    input.endsAt ?? null,
    input.announceAt ?? null,
    input.paymentDeadlineAt ?? null,
    input.url ?? null,
    input.notes ?? null,
    now,
    now,
  ];
  // Materialize the sale ID before link inserts can change last_insert_rowid().
  // Both statements remain in one atomic D1 batch.
  const writes = [
    statement(
      `INSERT INTO ticket_sale (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) RETURNING id`,
      values,
    ),
  ];
  if (input.tierIds.length) {
    writes.push(
      statement(
        `WITH sale AS MATERIALIZED (SELECT last_insert_rowid() AS id) INSERT INTO ticket_sale_tier (sale_id,tier_id) SELECT sale.id, value FROM sale CROSS JOIN json_each(?)`,
        [JSON.stringify(input.tierIds)],
      ),
    );
  }
  const results = await atomicBatch(writes);
  const id = (results[0].results[0] as { id: number }).id;
  const row = await prisma.ticketSale.findUniqueOrThrow({
    where: { id },
    include: { vendor: true, tiers: { include: { tier: true } } },
  });
  return { ...row, tiers: row.tiers.map((link) => link.tier) };
}

async function validateTiers(liveId: number, tierIds: number[]) {
  const rows = await prisma.ticketTier.findMany({
    where: { id: { in: tierIds }, format: { liveId } },
    select: { id: true },
  });
  const matched = new Set(rows.map((row) => row.id));
  for (const id of tierIds) {
    if (!matched.has(id))
      throw new Error(
        `tierId=${id} 는 본 라이브(liveId=${liveId}) 에 속하지 않는 티어입니다.`,
      );
  }
}

export type UpdateTicketSalePatch = Partial<{
  vendorId: number;
  type: TicketSaleType;
  method: TicketSaleMethod;
  label: string | null;
  startsAt: Date;
  endsAt: Date | null;
  announceAt: Date | null;
  paymentDeadlineAt: Date | null;
  url: string | null;
  notes: string | null;
}>;

/**
 * 라운드 메타 업데이트 (tier 링크는 setTicketSaleTiers 별도 호출).
 *  - 존재하지 않으면 throw.
 */
export async function updateTicketSale(
  saleId: number,
  patch: UpdateTicketSalePatch,
): Promise<TicketSale> {
  const existing = await prisma.ticketSale.findUnique({
    where: { id: saleId },
  });
  if (!existing) {
    throw new Error(`TicketSale(id=${saleId}) 를 찾을 수 없습니다.`);
  }
  return prisma.ticketSale.update({
    where: { id: saleId },
    data: patch as Prisma.TicketSaleUncheckedUpdateInput,
  });
}

/**
 * 메타 patch + tier 링크 교체를 단일 트랜잭션으로 수행.
 *
 * 사용 동기: UI 가 update + setTiers 를 순차 호출하면, 한쪽이 실패해도 다른
 * 쪽 변경이 이미 커밋된 상태가 된다 (HIGH 리뷰 issue 대응).
 *
 * - cross-live tier 가드는 쓰기 전에 읽기로 검증.
 * - patch 가 비어 있으면 update 는 생략하고 tier 만 교체.
 */
export async function updateTicketSaleWithTiers(
  saleId: number,
  patch: UpdateTicketSalePatch,
  tierIds: number[] | null,
): Promise<void> {
  const sale = await prisma.ticketSale.findUnique({
    where: { id: saleId },
    select: { liveId: true },
  });
  if (!sale) throw new Error(`TicketSale(id=${saleId}) 를 찾을 수 없습니다.`);
  if (tierIds !== null) await validateTiers(sale.liveId, tierIds);
  const columns: Record<keyof UpdateTicketSalePatch, string> = {
    vendorId: "vendor_id",
    type: "type",
    method: "method",
    label: "label",
    startsAt: "starts_at",
    endsAt: "ends_at",
    announceAt: "announce_at",
    paymentDeadlineAt: "payment_deadline_at",
    url: "url",
    notes: "notes",
  };
  const entries = Object.entries(patch).filter(
    ([, value]) => value !== undefined,
  ) as [keyof UpdateTicketSalePatch, unknown][];
  const writes = [];
  if (entries.length)
    writes.push(
      statement(
        `UPDATE ticket_sale SET ${entries.map(([key]) => `"${columns[key]}" = ?`).join(",")}, updated_at = ? WHERE id = ?`,
        [...entries.map(([, value]) => value), new Date(), saleId],
      ),
    );
  if (tierIds !== null) {
    writes.push(
      statement("DELETE FROM ticket_sale_tier WHERE sale_id = ?", [saleId]),
    );
    if (tierIds.length)
      writes.push(
        statement(
          "INSERT INTO ticket_sale_tier (sale_id,tier_id) SELECT ?, value FROM json_each(?)",
          [saleId, JSON.stringify(tierIds)],
        ),
      );
  }
  await atomicBatch(writes);
}

/**
 * 라운드 삭제. TicketSaleTier cascade.
 */
export async function deleteTicketSale(saleId: number): Promise<void> {
  const existing = await prisma.ticketSale.findUnique({
    where: { id: saleId },
  });
  if (!existing) {
    throw new Error(`TicketSale(id=${saleId}) 를 찾을 수 없습니다.`);
  }
  await prisma.ticketSale.delete({ where: { id: saleId } });
}

/**
 * 라운드의 tier 링크를 통째로 교체.
 *  - tierIds [] 은 모든 링크 제거 (clears all).
 *  - 모든 tierId 는 sale 의 liveId 와 동일 라이브의 format 에 속해야 한다.
 *  - D1 batch: DELETE + INSERT SELECT.
 */
export async function setTicketSaleTiers(
  saleId: number,
  tierIds: number[],
): Promise<void> {
  await updateTicketSaleWithTiers(saleId, {}, tierIds);
}

/**
 * Cross-live 가드: sale → liveId.
 *  - action 레이어가 권한 검사할 때 호출.
 *  - 존재하지 않으면 null.
 */
export async function getSaleLiveId(saleId: number): Promise<number | null> {
  const row = await prisma.ticketSale.findUnique({
    where: { id: saleId },
    select: { liveId: true },
  });
  return row?.liveId ?? null;
}
