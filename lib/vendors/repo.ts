/**
 * Vendor 도메인 DB I/O 단일 진입점.
 *
 * 발매처 마스터 데이터 (e+, 로손티켓, FC 사이트, 공식 등).
 *  - slug 는 globally unique.
 *  - 삭제 시 TicketSale.vendorId 가 onDelete: Restrict 이므로 사용 중이면 P2003 → "사용 중인 발매처는 삭제할 수 없습니다".
 */
import type { Vendor } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Prisma error code 판별. */
function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

/** name asc 로 정렬된 vendor 목록. */
export async function listVendors(): Promise<Vendor[]> {
  return prisma.vendor.findMany({
    orderBy: { name: "asc" },
  });
}

/** 단건 조회. */
export async function getVendorById(id: number): Promise<Vendor | null> {
  return prisma.vendor.findUnique({ where: { id } });
}

export type CreateVendorInput = {
  slug: string;
  name: string;
  baseUrl?: string | null;
  logoUrl?: string | null;
  notes?: string | null;
};

/**
 * Vendor 생성.
 *  - P2002 (slug unique) → "이미 사용 중인 slug".
 */
export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  try {
    return await prisma.vendor.create({
      data: {
        slug: input.slug,
        name: input.name,
        baseUrl: input.baseUrl ?? null,
        logoUrl: input.logoUrl ?? null,
        notes: input.notes ?? null,
      },
    });
  } catch (err) {
    if (getPrismaErrorCode(err) === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다: "${input.slug}".`);
    }
    throw err;
  }
}

export type UpdateVendorPatch = Partial<{
  slug: string;
  name: string;
  baseUrl: string | null;
  logoUrl: string | null;
  notes: string | null;
}>;

/**
 * 부분 업데이트.
 *  - not-found → throw.
 *  - P2002 (slug) → "이미 사용 중인 slug".
 */
export async function updateVendor(
  id: number,
  patch: UpdateVendorPatch
): Promise<Vendor> {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Vendor(id=${id}) 를 찾을 수 없습니다.`);
  }
  try {
    return await prisma.vendor.update({ where: { id }, data: patch });
  } catch (err) {
    if (getPrismaErrorCode(err) === "P2002") {
      throw new Error(`이미 사용 중인 slug 입니다.`);
    }
    throw err;
  }
}

/**
 * Vendor 삭제.
 *  - TicketSale.vendorId 는 onDelete: Restrict → 사용 중이면 P2003.
 *  - P2003 → "사용 중인 발매처는 삭제할 수 없습니다".
 *  - P2025 (not found) → "찾을 수 없".
 */
export async function deleteVendor(id: number): Promise<void> {
  try {
    await prisma.vendor.delete({ where: { id } });
  } catch (err) {
    const code = getPrismaErrorCode(err);
    if (code === "P2003") {
      throw new Error("사용 중인 발매처는 삭제할 수 없습니다.");
    }
    if (code === "P2025") {
      throw new Error(`Vendor(id=${id}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}
