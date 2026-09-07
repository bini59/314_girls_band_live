/**
 * API 키 가드 — 공개 API 요청의 X-API-Key 헤더를 검증한다.
 *
 * 어드민 쿠키 세션 가드(lib/auth/guard.ts)와 분리된 순수 검증기.
 * 유효한 활성 키면 ApiKey, 아니면 null. throw 하지 않는다.
 * lastUsedAt 갱신은 라우트 레이어 책임(guard 는 순수).
 */
import type { ApiKey } from "@prisma/client";

import { findActiveByHash } from "@/lib/api-key/repo";
import { hashApiKey } from "@/lib/api-key/hash";

export async function verifyApiKey(request: Request): Promise<ApiKey | null> {
  const key = request.headers.get("x-api-key");
  if (!key) return null;
  return findActiveByHash(hashApiKey(key));
}
