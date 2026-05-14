/**
 * Work (작품) 도메인 DB I/O.
 *
 *  - slug 는 globally unique.
 *  - seriesId 는 nullable. 존재하지 않는 series 참조 시 P2003 → "존재하지 않는 시리즈".
 *  - 삭제 시 Band.workId 는 onDelete: Restrict → 사용 중이면 P2003.
 *
 * listWorks / getWorkById 는 series 를 include 하여 UI 셀렉트/표시에 사용.
 */
import type { Prisma, Series, Work } from "@prisma/client";

import { prisma } from "@/lib/db";

export type WorkWithSeries = Work & { series: Series | null };

function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

/** nameKo asc + series include. */
export async function listWorks(): Promise<WorkWithSeries[]> {
  return prisma.work.findMany({
    orderBy: { nameKo: "asc" },
    include: { series: true },
  });
}

/** 단건 조회 (series include). */
export async function getWorkById(id: number): Promise<WorkWithSeries | null> {
  return prisma.work.findUnique({
    where: { id },
    include: { series: true },
  });
}

export type CreateWorkInput = {
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn?: string | null;
  kind?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  seriesId?: number | null;
};

/**
 * Work 생성.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 (seriesId FK) → "존재하지 않는 시리즈".
 */
export async function createWork(input: CreateWorkInput): Promise<Work> {
  try {
    return await prisma.work.create({
      data: {
        slug: input.slug,
        nameKo: input.nameKo,
        nameJp: input.nameJp,
        nameEn: input.nameEn ?? null,
        kind: input.kind ?? null,
        logoUrl: input.logoUrl ?? null,
        description: input.description ?? null,
        seriesId: input.seriesId ?? null,
      },
    });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다: "${input.slug}".`);
    }
    if (code === "P2003") {
      throw new Error("존재하지 않는 시리즈입니다.");
    }
    throw err;
  }
}

export type UpdateWorkPatch = Partial<{
  slug: string;
  nameKo: string;
  nameJp: string;
  nameEn: string | null;
  kind: string | null;
  logoUrl: string | null;
  description: string | null;
  seriesId: number | null;
}>;

/**
 * 부분 업데이트.
 *  - not-found → throw.
 *  - P2002 → "이미 사용 중인 slug".
 *  - P2003 → "존재하지 않는 시리즈".
 */
export async function updateWork(
  id: number,
  patch: UpdateWorkPatch
): Promise<Work> {
  const existing = await prisma.work.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Work(id=${id}) 를 찾을 수 없습니다.`);
  }
  try {
    // Prisma 의 Update payload 는 nullable FK 도 그대로 받음.
    const data: Prisma.WorkUncheckedUpdateInput = patch;
    return await prisma.work.update({ where: { id }, data });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다.`);
    }
    if (code === "P2003") {
      throw new Error("존재하지 않는 시리즈입니다.");
    }
    throw err;
  }
}

/**
 * Work 삭제.
 *  - Band.workId 는 onDelete: Restrict → 사용 중이면 P2003.
 *  - P2003 → "사용 중인 작품은 삭제할 수 없습니다".
 *  - P2025 (not found) → "찾을 수 없".
 */
export async function deleteWork(id: number): Promise<void> {
  try {
    await prisma.work.delete({ where: { id } });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2003") {
      throw new Error("사용 중인 작품은 삭제할 수 없습니다.");
    }
    if (code === "P2025") {
      throw new Error(`Work(id=${id}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}
