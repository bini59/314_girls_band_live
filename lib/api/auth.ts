/**
 * 공개 API 라우트 공용 인증 헬퍼.
 *
 * verifyApiKey 는 순수 검증기라 lastUsedAt 갱신은 라우트 책임.
 * 성공 시 touchLastUsed 를 fire-and-forget 로 호출한다 (요청 흐름 비차단).
 */
import type { ApiKey } from "@prisma/client";

import { verifyApiKey } from "@/lib/auth/api-key-guard";
import { touchLastUsed } from "@/lib/api-key/repo";

export async function authenticateApiRequest(
  request: Request
): Promise<ApiKey | null> {
  const apiKey = await verifyApiKey(request);
  if (!apiKey) return null;
  // ponytail: fire-and-forget, 실패해도 요청 진행. unhandled rejection 방지용 catch.
  void touchLastUsed(apiKey.id).catch(() => {});
  return apiKey;
}
