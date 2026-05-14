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
} from "@prisma/client";

import { prisma } from "@/lib/db";

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
  liveId: number
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

/**
 * 라운드 생성 — atomic.
 *
 * 단계:
 *  1) tierIds 가 모두 본 liveId 의 format 에 속하는지 검증 (raw SQL 1회).
 *  2) TicketSale row 생성.
 *  3) TicketSaleTier rows 생성 (createMany).
 *  4) vendor + tiers include 한 결과 반환.
 *
 * 한 tierId 라도 cross-live 면 트랜잭션 전체 롤백 → TicketSale row 도 남지 않는다.
 */
export async function createTicketSale(
  input: CreateTicketSaleInput
): Promise<TicketSaleWithRelations> {
  return prisma.$transaction(async (tx) => {
    if (input.tierIds.length > 0) {
      // tierIds 가 모두 본 liveId 의 format 에 속하는지 검증.
      const rows = await tx.ticketTier.findMany({
        where: {
          id: { in: input.tierIds },
          format: { liveId: input.liveId },
        },
        select: { id: true },
      });
      const matched = new Set(rows.map((r) => r.id));
      for (const tierId of input.tierIds) {
        if (!matched.has(tierId)) {
          throw new Error(
            `createTicketSale: tierId=${tierId} 는 본 라이브(liveId=${input.liveId}) 에 속하지 않는 티어입니다.`
          );
        }
      }
    }

    const sale = await tx.ticketSale.create({
      data: {
        liveId: input.liveId,
        vendorId: input.vendorId,
        type: input.type,
        method: input.method,
        label: input.label ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        announceAt: input.announceAt ?? null,
        paymentDeadlineAt: input.paymentDeadlineAt ?? null,
        url: input.url ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.tierIds.length > 0) {
      await tx.ticketSaleTier.createMany({
        data: input.tierIds.map((tierId) => ({
          saleId: sale.id,
          tierId,
        })),
      });
    }

    const reloaded = await tx.ticketSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        vendor: true,
        tiers: { include: { tier: true } },
      },
    });

    const { tiers, ...rest } = reloaded;
    return {
      ...rest,
      tiers: tiers.map((t) => t.tier),
    };
  });
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
  patch: UpdateTicketSalePatch
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
 * - cross-live tier 가드는 동일 트랜잭션 안에서 강제.
 * - patch 가 비어 있으면 update 는 생략하고 tier 만 교체.
 */
export async function updateTicketSaleWithTiers(
  saleId: number,
  patch: UpdateTicketSalePatch,
  tierIds: number[] | null
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.ticketSale.findUnique({
      where: { id: saleId },
      select: { id: true, liveId: true },
    });
    if (!sale) {
      throw new Error(`TicketSale(id=${saleId}) 를 찾을 수 없습니다.`);
    }

    if (Object.keys(patch).length > 0) {
      await tx.ticketSale.update({
        where: { id: saleId },
        data: patch as Prisma.TicketSaleUncheckedUpdateInput,
      });
    }

    if (tierIds !== null) {
      if (tierIds.length > 0) {
        const rows = await tx.ticketTier.findMany({
          where: {
            id: { in: tierIds },
            format: { liveId: sale.liveId },
          },
          select: { id: true },
        });
        const matched = new Set(rows.map((r) => r.id));
        for (const tierId of tierIds) {
          if (!matched.has(tierId)) {
            throw new Error(
              `updateTicketSaleWithTiers: tierId=${tierId} 는 본 라이브(liveId=${sale.liveId}) 에 속하지 않는 티어입니다.`
            );
          }
        }
      }
      await tx.ticketSaleTier.deleteMany({ where: { saleId } });
      if (tierIds.length > 0) {
        await tx.ticketSaleTier.createMany({
          data: tierIds.map((tierId) => ({ saleId, tierId })),
        });
      }
    }
  });
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
 *  - 트랜잭션: deleteMany + createMany.
 */
export async function setTicketSaleTiers(
  saleId: number,
  tierIds: number[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.ticketSale.findUnique({
      where: { id: saleId },
      select: { id: true, liveId: true },
    });
    if (!sale) {
      throw new Error(`TicketSale(id=${saleId}) 를 찾을 수 없습니다.`);
    }

    if (tierIds.length > 0) {
      const rows = await tx.ticketTier.findMany({
        where: {
          id: { in: tierIds },
          format: { liveId: sale.liveId },
        },
        select: { id: true },
      });
      const matched = new Set(rows.map((r) => r.id));
      for (const tierId of tierIds) {
        if (!matched.has(tierId)) {
          throw new Error(
            `setTicketSaleTiers: tierId=${tierId} 는 본 라이브(liveId=${sale.liveId}) 에 속하지 않는 티어입니다.`
          );
        }
      }
    }

    await tx.ticketSaleTier.deleteMany({ where: { saleId } });
    if (tierIds.length > 0) {
      await tx.ticketSaleTier.createMany({
        data: tierIds.map((tierId) => ({ saleId, tierId })),
      });
    }
  });
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
