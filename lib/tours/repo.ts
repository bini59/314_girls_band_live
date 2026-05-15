/**
 * Tour (투어) 도메인 DB I/O.
 *
 *  - slug 는 globally unique → P2002 → "이미 사용 중인 slug".
 *  - workId FK → 존재하지 않으면 P2003 → "존재하지 않는 작품".
 *  - Tour 삭제 시 Live.tourId 는 onDelete: SetNull → Live 는 보존되고 tourId 만 NULL.
 *  - Work 삭제 시 Tour.workId 는 onDelete: Restrict → 사용 중인 Work 삭제 차단.
 *
 *  listTours / getTourById 는 work 와 live count 를 include 하여 UI 표시에 사용.
 */
import type { Prisma, Tour, TourStatus, Work } from "@prisma/client";

import { prisma } from "@/lib/db";

export type TourWithWork = Tour & { work: Work };
export type TourWithCounts = Tour & {
  work: Work;
  _count: { lives: number };
};

function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

/** nameKo asc + work include + lives 카운트. */
export async function listTours(): Promise<TourWithCounts[]> {
  return prisma.tour.findMany({
    orderBy: { nameKo: "asc" },
    include: {
      work: true,
      _count: { select: { lives: true } },
    },
  });
}

/** 특정 작품의 투어만 (Live 폼 셀렉트용). */
export async function listToursByWorkId(workId: number): Promise<Tour[]> {
  return prisma.tour.findMany({
    where: { workId },
    orderBy: { nameKo: "asc" },
  });
}

/** 단건 조회 (work include). */
export async function getTourById(id: number): Promise<TourWithWork | null> {
  return prisma.tour.findUnique({
    where: { id },
    include: { work: true },
  });
}

/** slug 단건 조회. */
export async function getTourBySlug(slug: string): Promise<TourWithWork | null> {
  return prisma.tour.findUnique({
    where: { slug },
    include: { work: true },
  });
}

export type CreateTourInput = {
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
  officialUrl?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status?: TourStatus;
};

/**
 * Tour 생성.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 (workId FK) → "존재하지 않는 작품".
 */
export async function createTour(input: CreateTourInput): Promise<Tour> {
  try {
    return await prisma.tour.create({
      data: {
        workId: input.workId,
        slug: input.slug,
        nameKo: input.nameKo,
        nameJp: input.nameJp,
        nameEn: input.nameEn ?? null,
        description: input.description ?? null,
        posterUrl: input.posterUrl ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        officialUrl: input.officialUrl ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        status: input.status ?? "DRAFT",
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

export type UpdateTourPatch = Partial<{
  workId: number;
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string | null;
  description: string | null;
  posterUrl: string | null;
  thumbnailUrl: string | null;
  officialUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: TourStatus;
}>;

/**
 * 부분 업데이트.
 *  - not-found → throw.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 → "존재하지 않는 작품".
 */
export async function updateTour(
  id: number,
  patch: UpdateTourPatch
): Promise<Tour> {
  const existing = await prisma.tour.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Tour(id=${id}) 를 찾을 수 없습니다.`);
  }
  try {
    const data: Prisma.TourUncheckedUpdateInput = patch;
    return await prisma.tour.update({ where: { id }, data });
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
 * Tour 삭제.
 *  - Live.tourId 는 onDelete: SetNull → Live 는 보존되고 tourId 만 NULL.
 *  - P2025 (not found) → "찾을 수 없".
 */
export async function deleteTour(id: number): Promise<void> {
  try {
    await prisma.tour.delete({ where: { id } });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2025") {
      throw new Error(`Tour(id=${id}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}
