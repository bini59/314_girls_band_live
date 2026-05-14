/**
 * Series (시리즈/IP) 도메인 DB I/O.
 *
 *  - slug 는 globally unique.
 *  - 삭제 시 Work.seriesId onDelete: SetNull → 연결된 작품이 detach 되며 삭제 자체는 자유.
 */
import type { Series } from "@prisma/client";

import { prisma } from "@/lib/db";

function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

/** nameKo asc 로 정렬된 series 목록. */
export async function listSeries(): Promise<Series[]> {
  return prisma.series.findMany({
    orderBy: { nameKo: "asc" },
  });
}

/** 단건 조회. */
export async function getSeriesById(id: number): Promise<Series | null> {
  return prisma.series.findUnique({ where: { id } });
}

export type CreateSeriesInput = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string | null;
  logoUrl?: string | null;
  description?: string | null;
};

/**
 * Series 생성.
 *  - P2002 (slug unique) → "이미 사용 중인 slug".
 */
export async function createSeries(input: CreateSeriesInput): Promise<Series> {
  try {
    return await prisma.series.create({
      data: {
        slug: input.slug,
        nameKo: input.nameKo,
        nameJp: input.nameJp,
        nameEn: input.nameEn ?? null,
        logoUrl: input.logoUrl ?? null,
        description: input.description ?? null,
      },
    });
  } catch (err) {
    if (getPrismaErrorCode(err) === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다: "${input.slug}".`);
    }
    throw err;
  }
}

export type UpdateSeriesPatch = Partial<{
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string | null;
  logoUrl: string | null;
  description: string | null;
}>;

/**
 * 부분 업데이트.
 *  - not-found → throw.
 *  - P2002 (slug) → "이미 사용 중인 slug".
 */
export async function updateSeries(
  id: number,
  patch: UpdateSeriesPatch
): Promise<Series> {
  const existing = await prisma.series.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Series(id=${id}) 를 찾을 수 없습니다.`);
  }
  try {
    return await prisma.series.update({ where: { id }, data: patch });
  } catch (err) {
    if (getPrismaErrorCode(err) === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다.`);
    }
    throw err;
  }
}

/**
 * Series 삭제.
 *  - Work.seriesId 는 onDelete: SetNull → 연결된 작품은 detach.
 *  - P2025 (not found) → "찾을 수 없".
 */
export async function deleteSeries(id: number): Promise<void> {
  try {
    await prisma.series.delete({ where: { id } });
  } catch (err) {
    if (getPrismaErrorCode(err) === "P2025") {
      throw new Error(`Series(id=${id}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}
