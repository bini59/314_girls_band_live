/**
 * Band 도메인 DB I/O 단일 진입점.
 *
 *  - searchBands: 다국어 (nameKo / nameJp / nameEn / slug) ILIKE 검색.
 *    빈 입력은 [] (전체 조회 방지). limit 상한 50.
 *  - listBandsByIds: 라인업 표시용 bulk 조회.
 *  - getBandById: 단건 조회.
 *
 * 본 repo 는 Band 의 부모(Work) 까지는 include 하지 않는다. 필요 시 호출자에서 추가.
 */
import type { Band } from "@prisma/client";

import { prisma } from "@/lib/db";

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
