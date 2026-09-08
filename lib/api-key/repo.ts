/**
 * ApiKey 레포지토리 — DB I/O 단일 진입점.
 *
 * 평문은 createApiKey 반환값으로만 노출되고 DB 에는 keyHash + keyPrefix 만 저장한다.
 */
import type { ApiKey } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateApiKey } from "./hash";

export async function createApiKey(
  name: string
): Promise<{ apiKey: ApiKey; plaintext: string }> {
  const { plaintext, hash, prefix } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: { name, keyHash: hash, keyPrefix: prefix },
  });
  return { apiKey, plaintext };
}

export function listApiKeys(): Promise<ApiKey[]> {
  return prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * 어드민 목록 페이지용 — 검색 + 페이지네이션.
 *
 * 검색 대상: name / keyPrefix (부분일치, 대소문자 무시).
 * keyHash 는 검색 대상에서 제외한다 — 해시로 키를 역추적할 여지를 주지 않는다.
 */
export async function searchApiKeys(options: {
  q?: string;
  skip: number;
  take: number;
}): Promise<{ rows: ApiKey[]; total: number }> {
  const where = options.q
    ? {
        OR: [
          { name: { contains: options.q, mode: "insensitive" as const } },
          { keyPrefix: { contains: options.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
    }),
    prisma.apiKey.count({ where }),
  ]);

  return { rows, total };
}

export function revokeApiKey(id: number): Promise<ApiKey> {
  return prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export function findActiveByHash(hash: string): Promise<ApiKey | null> {
  return prisma.apiKey.findFirst({ where: { keyHash: hash, revokedAt: null } });
}

export async function touchLastUsed(id: number): Promise<void> {
  await prisma.apiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}
