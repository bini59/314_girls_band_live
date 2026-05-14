/**
 * Band 도메인 DB I/O 단일 진입점.
 *
 *  - searchBands: 다국어 (nameKo / nameJp / nameEn / slug) ILIKE 검색.
 *    빈 입력은 [] (전체 조회 방지). limit 상한 50.
 *  - listBandsByIds: 라인업 표시용 bulk 조회.
 *  - getBandById: 단건 조회.
 *  - listBands / createBand / updateBand / deleteBand: 어드민 CRUD.
 *    listBands 는 work include + nameKo asc, workId 필터 가능.
 *
 * 본 repo 는 Band 의 부모(Work) 까지는 검색 함수에서 include 하지 않는다.
 * 어드민 CRUD 는 work include 가 필요하므로 listBands 가 명시적으로 include 한다.
 */
import type { Band, Work } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type BandWithWork = Band & { work: Work };

function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

/**
 * 다국어 + slug 부분 일치 검색.
 *  - mode: insensitive → PG ILIKE.
 *  - 빈/공백 query → [] (전체 row 노출 방지).
 *  - limit 은 MAX_SEARCH_LIMIT (50) 으로 clamp.
 */
export async function searchBands(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT
): Promise<Band[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const safeLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);

  return prisma.band.findMany({
    where: {
      OR: [
        { nameKo: { contains: trimmed, mode: "insensitive" } },
        { nameJp: { contains: trimmed, mode: "insensitive" } },
        { nameEn: { contains: trimmed, mode: "insensitive" } },
        { slug: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    take: safeLimit,
    orderBy: { id: "asc" },
  });
}

/**
 * id 목록으로 bulk 조회. 빈 배열 → [].
 *  - 순서 보장 없음 — 호출자가 필요 시 정렬.
 */
export async function listBandsByIds(ids: number[]): Promise<Band[]> {
  if (ids.length === 0) {
    return [];
  }
  return prisma.band.findMany({
    where: { id: { in: ids } },
  });
}

/** 단건 조회. */
export async function getBandById(id: number): Promise<Band | null> {
  return prisma.band.findUnique({
    where: { id },
  });
}

// =====================================================================
// 어드민 CRUD
// =====================================================================

export type ListBandsFilter = {
  workId?: number;
};

/** 어드민 목록 (work include + nameKo asc, workId 필터). */
export async function listBands(
  filter: ListBandsFilter = {}
): Promise<BandWithWork[]> {
  return prisma.band.findMany({
    where: filter.workId !== undefined ? { workId: filter.workId } : {},
    orderBy: { nameKo: "asc" },
    include: { work: true },
  });
}

export type CreateBandInput = {
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string | null;
  officialUrl?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  snsLinks?: Record<string, string> | null;
};

/**
 * Band 생성.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 (workId FK) → "존재하지 않는 작품".
 */
export async function createBand(input: CreateBandInput): Promise<Band> {
  try {
    return await prisma.band.create({
      data: {
        workId: input.workId,
        slug: input.slug,
        nameKo: input.nameKo,
        nameJp: input.nameJp,
        nameEn: input.nameEn ?? null,
        officialUrl: input.officialUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        description: input.description ?? null,
        snsLinks:
          input.snsLinks == null
            ? Prisma.JsonNull
            : (input.snsLinks as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다: "${input.slug}".`);
    }
    if (code === "P2003") {
      throw new Error("존재하지 않는 작품입니다.");
    }
    throw err;
  }
}

export type UpdateBandPatch = Partial<{
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string | null;
  officialUrl: string | null;
  imageUrl: string | null;
  description: string | null;
  snsLinks: Record<string, string> | null;
}>;

/**
 * 부분 업데이트.
 *  - not-found → throw.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 (workId) → "존재하지 않는 작품".
 */
export async function updateBand(
  id: number,
  patch: UpdateBandPatch
): Promise<Band> {
  const existing = await prisma.band.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Band(id=${id}) 를 찾을 수 없습니다.`);
  }
  try {
    const data: Prisma.BandUncheckedUpdateInput = {};
    if (patch.workId !== undefined) data.workId = patch.workId;
    if (patch.slug !== undefined) data.slug = patch.slug;
    if (patch.nameKo !== undefined) data.nameKo = patch.nameKo;
    if (patch.nameJp !== undefined) data.nameJp = patch.nameJp;
    if (patch.nameEn !== undefined) data.nameEn = patch.nameEn;
    if (patch.officialUrl !== undefined) data.officialUrl = patch.officialUrl;
    if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.snsLinks !== undefined) {
      data.snsLinks =
        patch.snsLinks === null
          ? Prisma.JsonNull
          : (patch.snsLinks as Prisma.InputJsonValue);
    }
    return await prisma.band.update({ where: { id }, data });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2002") {
      throw new Error("이미 사용 중인 slug 입니다.");
    }
    if (code === "P2003") {
      throw new Error("존재하지 않는 작품입니다.");
    }
    throw err;
  }
}

/**
 * Band 삭제.
 *  - LiveBand.bandId 는 onDelete: Restrict → 출연 이력 있으면 P2003.
 *  - P2003 → "출연 이력이 있는 밴드는 삭제할 수 없습니다".
 *  - P2025 → "찾을 수 없".
 */
export async function deleteBand(id: number): Promise<void> {
  try {
    await prisma.band.delete({ where: { id } });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2003") {
      throw new Error("출연 이력이 있는 밴드는 삭제할 수 없습니다.");
    }
    if (code === "P2025") {
      throw new Error(`Band(id=${id}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}
