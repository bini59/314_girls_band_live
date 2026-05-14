/**
 * TicketTier 도메인 DB I/O 단일 진입점.
 *
 * 한 LiveFormat 내 좌석 등급/가격(예: "S석 지정 9,800엔").
 *  - reorder: 단일 트랜잭션으로 본 format 의 tier order 를 재할당.
 *  - 삭제 시 TicketSaleTier 까지 cascade.
 *  - cross-live 가드: `getTierLiveId` 로 action 레이어가 권한 검사.
 */
import type { TicketTier } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Prisma not-found (record-to-delete) 판별. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

/**
 * format 의 tier 목록.
 *  - 정렬: order asc, id asc.
 */
export async function listTicketTiers(formatId: number): Promise<TicketTier[]> {
  return prisma.ticketTier.findMany({
    where: { formatId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
}

export type CreateTicketTierInput = {
  formatId: number;
  name: string;
  priceJpy: number;
  order?: number;
  notes?: string | null;
};

export async function createTicketTier(
  input: CreateTicketTierInput
): Promise<TicketTier> {
  return prisma.ticketTier.create({
    data: {
      formatId: input.formatId,
      name: input.name,
      priceJpy: input.priceJpy,
      order: input.order ?? 0,
      notes: input.notes ?? null,
    },
  });
}

export type UpdateTicketTierPatch = Partial<{
  name: string;
  priceJpy: number;
  order: number;
  notes: string | null;
}>;

/**
 * 부분 업데이트. 존재하지 않으면 throw.
 */
export async function updateTicketTier(
  tierId: number,
  patch: UpdateTicketTierPatch
): Promise<TicketTier> {
  const existing = await prisma.ticketTier.findUnique({
    where: { id: tierId },
  });
  if (!existing) {
    throw new Error(`TicketTier(id=${tierId}) 를 찾을 수 없습니다.`);
  }
  return prisma.ticketTier.update({
    where: { id: tierId },
    data: patch,
  });
}

/**
 * TicketTier 삭제. TicketSaleTier cascade.
 *  - 존재하지 않으면 throw.
 */
export async function deleteTicketTier(tierId: number): Promise<void> {
  try {
    await prisma.ticketTier.delete({ where: { id: tierId } });
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new Error(`TicketTier(id=${tierId}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}

/**
 * format 내 tier 들의 순서를 재할당.
 *  - 모든 tierId 가 본 formatId 에 속해야 한다.
 *  - 빈 배열은 throw.
 */
export async function reorderTicketTiers(
  formatId: number,
  orderedTierIds: number[]
): Promise<void> {
  if (orderedTierIds.length === 0) {
    throw new Error("reorderTicketTiers: orderedTierIds 가 비어 있습니다.");
  }

  const existing = await prisma.ticketTier.findMany({
    where: { formatId, id: { in: orderedTierIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));

  for (const tierId of orderedTierIds) {
    if (!existingIds.has(tierId)) {
      throw new Error(
        `reorderTicketTiers: tierId=${tierId} 는 formatId=${formatId} 에 속하지 않습니다.`
      );
    }
  }

  await prisma.$transaction(
    orderedTierIds.map((tierId, idx) =>
      prisma.ticketTier.update({
        where: { id: tierId },
        data: { order: idx },
      })
    )
  );
}

/**
 * Cross-live 가드: tier → format → liveId.
 *  - action 레이어가 "이 tier 가 이 live 의 것인가?" 검사할 때 호출.
 *  - 존재하지 않으면 null.
 */
export async function getTierLiveId(tierId: number): Promise<number | null> {
  const row = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    select: { format: { select: { liveId: true } } },
  });
  return row?.format.liveId ?? null;
}
