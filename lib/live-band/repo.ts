/**
 * LiveBand 도메인 DB I/O 단일 진입점.
 *
 * Live ↔ Band N:M 조인 테이블. 페스/대반 출연 라인업을 관리한다.
 *  - composite PK: (liveId, bandId).
 *  - order 는 라인업 표시 순서 (0-based, 작을수록 앞).
 *  - isHeadliner 는 헤드라이너 여부 (페스에서 의미).
 *  - reorder 는 단일 트랜잭션으로 전체 라이브의 출연 순서를 갱신.
 */
import type { Band, LiveBand } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Prisma unique violation 인지 판별. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * 라이브의 출연 밴드 목록.
 *  - 정렬: order asc, bandId asc.
 *  - band relation include.
 */
export async function listLiveBands(
  liveId: number
): Promise<(LiveBand & { band: Band })[]> {
  return prisma.liveBand.findMany({
    where: { liveId },
    orderBy: [{ order: "asc" }, { bandId: "asc" }],
    include: { band: true },
  });
}

export type AddLiveBandInput = {
  liveId: number;
  bandId: number;
  isHeadliner?: boolean;
  order?: number;
};

/**
 * 라이브에 밴드 추가.
 *  - P2002 (composite PK 중복) → "이미 추가된 밴드".
 */
export async function addLiveBand(input: AddLiveBandInput): Promise<LiveBand> {
  try {
    return await prisma.liveBand.create({
      data: {
        liveId: input.liveId,
        bandId: input.bandId,
        isHeadliner: input.isHeadliner ?? false,
        order: input.order ?? 0,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(
        `LiveBand(liveId=${input.liveId}, bandId=${input.bandId}) 는 이미 추가된 밴드입니다.`
      );
    }
    throw err;
  }
}

export type UpdateLiveBandPatch = Partial<{
  isHeadliner: boolean;
  order: number;
}>;

/**
 * 라인업 row 업데이트 (composite PK).
 *  - 존재하지 않으면 throw.
 */
export async function updateLiveBand(
  liveId: number,
  bandId: number,
  patch: UpdateLiveBandPatch
): Promise<LiveBand> {
  const existing = await prisma.liveBand.findUnique({
    where: { liveId_bandId: { liveId, bandId } },
  });
  if (!existing) {
    throw new Error(
      `LiveBand(liveId=${liveId}, bandId=${bandId}) 를 찾을 수 없습니다.`
    );
  }
  return prisma.liveBand.update({
    where: { liveId_bandId: { liveId, bandId } },
    data: patch,
  });
}

/**
 * 라인업에서 밴드 제거. 멱등 — 존재하지 않아도 throw 하지 않는다.
 * (deleteMany 는 P2025 대신 count 0 을 반환)
 */
export async function removeLiveBand(
  liveId: number,
  bandId: number
): Promise<void> {
  await prisma.liveBand.deleteMany({
    where: { liveId, bandId },
  });
}

/**
 * 라인업 전체 재정렬.
 *  - orderedBandIds 의 모든 bandId 가 본 liveId 에 속해야 한다.
 *  - 단일 트랜잭션으로 각 row 의 order 를 index 로 갱신.
 *  - 빈 배열은 throw — 명시적 의도가 있다면 호출자가 별도 처리.
 */
export async function reorderLiveBands(
  liveId: number,
  orderedBandIds: number[]
): Promise<void> {
  if (orderedBandIds.length === 0) {
    throw new Error("reorderLiveBands: orderedBandIds 가 비어 있습니다.");
  }

  // 본 라이브에 속한 LiveBand row 확인.
  const existing = await prisma.liveBand.findMany({
    where: { liveId, bandId: { in: orderedBandIds } },
    select: { bandId: true },
  });
  const existingIds = new Set(existing.map((row) => row.bandId));

  for (const bandId of orderedBandIds) {
    if (!existingIds.has(bandId)) {
      throw new Error(
        `reorderLiveBands: bandId=${bandId} 는 liveId=${liveId} 에 속하지 않습니다.`
      );
    }
  }

  await prisma.$transaction(
    orderedBandIds.map((bandId, idx) =>
      prisma.liveBand.update({
        where: { liveId_bandId: { liveId, bandId } },
        data: { order: idx },
      })
    )
  );
}
