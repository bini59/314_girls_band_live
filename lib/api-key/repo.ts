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
