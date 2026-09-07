/**
 * ApiKey 레포지토리 통합 테스트 (RED — 구현 전).
 *
 * lib/api-key/repo.ts:
 *  - createApiKey(name): 평문 1회 반환, DB 엔 keyHash + keyPrefix 만 저장.
 *  - listApiKeys(): 최신순.
 *  - revokeApiKey(id): revokedAt 설정.
 *  - findActiveByHash(hash): revokedAt == null 인 것만 반환.
 *  - touchLastUsed(id): lastUsedAt 갱신.
 *
 * 격리: 각 it 전에 resetDb() (api_key 포함 TRUNCATE CASCADE).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { hashApiKey } from "./hash";

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  findActiveByHash,
  touchLastUsed,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("createApiKey", () => {
  it("평문을 1회 반환한다 ('gbl_' 접두사)", async () => {
    const { plaintext } = await createApiKey("ci-token");
    expect(plaintext.startsWith("gbl_")).toBe(true);
  });

  it("DB 에는 평문이 저장되지 않고 keyHash 만 저장된다", async () => {
    const { apiKey, plaintext } = await createApiKey("ci-token");
    const row = await testDb.apiKey.findUnique({ where: { id: apiKey.id } });

    expect(row?.keyHash).toBe(hashApiKey(plaintext));
    // 평문이 어떤 컬럼에도 새어나가지 않아야 한다.
    expect(JSON.stringify(row)).not.toContain(plaintext);
  });

  it("keyPrefix (평문 앞 8자) 를 저장한다", async () => {
    const { apiKey, plaintext } = await createApiKey("ci-token");
    expect(apiKey.keyPrefix).toBe(plaintext.slice(0, 8));
  });

  it("생성 직후 revokedAt 은 null", async () => {
    const { apiKey } = await createApiKey("ci-token");
    expect(apiKey.revokedAt).toBeNull();
  });
});

describe("findActiveByHash", () => {
  it("활성 키의 해시로 조회하면 row 반환", async () => {
    const { apiKey, plaintext } = await createApiKey("active-key");
    const found = await findActiveByHash(hashApiKey(plaintext));
    expect(found?.id).toBe(apiKey.id);
  });

  it("존재하지 않는 해시면 null", async () => {
    expect(await findActiveByHash(hashApiKey("gbl_nonexistent"))).toBeNull();
  });

  it("폐기된 키는 null", async () => {
    const { apiKey, plaintext } = await createApiKey("to-revoke");
    await revokeApiKey(apiKey.id);
    expect(await findActiveByHash(hashApiKey(plaintext))).toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("revokedAt 이 설정된다", async () => {
    const { apiKey } = await createApiKey("revoke-me");
    const revoked = await revokeApiKey(apiKey.id);
    expect(revoked.revokedAt).not.toBeNull();
  });
});

describe("listApiKeys", () => {
  it("빈 DB 면 빈 배열", async () => {
    expect(await listApiKeys()).toEqual([]);
  });

  it("최신순으로 정렬한다 (createdAt DESC)", async () => {
    const first = await createApiKey("first");
    await testDb.apiKey.update({
      where: { id: first.apiKey.id },
      data: { createdAt: new Date("2026-01-01T00:00:00Z") },
    });
    const second = await createApiKey("second");
    await testDb.apiKey.update({
      where: { id: second.apiKey.id },
      data: { createdAt: new Date("2026-06-01T00:00:00Z") },
    });

    const result = await listApiKeys();
    expect(result.map((k) => k.id)).toEqual([
      second.apiKey.id,
      first.apiKey.id,
    ]);
  });

  it("폐기된 키도 목록에는 포함된다 (관리 화면용)", async () => {
    const { apiKey } = await createApiKey("revoked-but-listed");
    await revokeApiKey(apiKey.id);
    const result = await listApiKeys();
    expect(result.map((k) => k.id)).toContain(apiKey.id);
  });
});

describe("touchLastUsed", () => {
  it("lastUsedAt 을 갱신한다", async () => {
    const { apiKey } = await createApiKey("used-key");
    expect(apiKey.lastUsedAt).toBeNull();

    await touchLastUsed(apiKey.id);

    const row = await testDb.apiKey.findUnique({ where: { id: apiKey.id } });
    expect(row?.lastUsedAt).not.toBeNull();
  });
});
