/**
 * API 키 가드 통합 테스트 (RED — 구현 전).
 *
 * lib/auth/api-key-guard.ts:
 *  - verifyApiKey(request): X-API-Key 헤더 추출 → sha256 → findActiveByHash 조회.
 *      유효 활성 키면 ApiKey, 아니면 null. (throw 하지 않음)
 *
 * 실제 DB 를 사용한다 (findActiveByHash 통합). 키는 팩토리로 통제된 평문으로 시드.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, disconnectDb } from "@/test/helpers/db";
import { createApiKeyRow } from "@/test/factories/api-key";

import { verifyApiKey } from "./api-key-guard";

const VALID_PLAINTEXT = "gbl_valid_plaintext_token";

function requestWithKey(key?: string): Request {
  const headers = new Headers();
  if (key !== undefined) headers.set("X-API-Key", key);
  return new Request("https://example.test/api/live", {
    method: "POST",
    headers,
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("verifyApiKey", () => {
  it("유효한 활성 키면 해당 ApiKey 를 반환한다", async () => {
    const { apiKey } = await createApiKeyRow({ plaintext: VALID_PLAINTEXT });

    const result = await verifyApiKey(requestWithKey(VALID_PLAINTEXT));
    expect(result?.id).toBe(apiKey.id);
  });

  it("X-API-Key 헤더가 없으면 null", async () => {
    await createApiKeyRow({ plaintext: VALID_PLAINTEXT });
    expect(await verifyApiKey(requestWithKey())).toBeNull();
  });

  it("존재하지 않는 키면 null", async () => {
    await createApiKeyRow({ plaintext: VALID_PLAINTEXT });
    expect(await verifyApiKey(requestWithKey("gbl_wrong_key"))).toBeNull();
  });

  it("폐기된 키면 null", async () => {
    await createApiKeyRow({
      plaintext: VALID_PLAINTEXT,
      revokedAt: new Date(),
    });
    expect(await verifyApiKey(requestWithKey(VALID_PLAINTEXT))).toBeNull();
  });
});
