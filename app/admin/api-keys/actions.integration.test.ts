/**
 * `/admin/api-keys/actions.ts` 통합 테스트 (RED — 액션 미구현).
 *
 * 대상:
 *  - issueApiKeyAction(name): 어드민 세션 강제. 평문을 1회 반환하고 DB 엔 해시+prefix 만 저장.
 *  - revokeApiKeyAction(id): 폐기 후 findActiveByHash 가 null (가드가 거부).
 *
 * 세션 가드 우회는 기존 admin action 테스트 패턴(test/helpers/admin-session)을 그대로 따른다.
 * 결과 형태는 프로젝트 action 컨벤션(`{ ok: true, ... } | { ok: false, error?/fieldErrors? }`)을 따른다.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { hashApiKey } from "@/lib/api-key/hash";
import { findActiveByHash } from "@/lib/api-key/repo";
import {
  cookieMocks,
  redirectMock,
  revalidatePathMock,
  mockAdminSession,
  mockNoSession,
  resetAdminSessionMocks,
  TEST_JWT_SECRET,
} from "@/test/helpers/admin-session";

vi.mock("next/headers", () => ({
  cookies: async () => cookieMocks.api,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: vi.fn(),
}));

beforeEach(async () => {
  resetAdminSessionMocks();
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
  await resetDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(async () => {
  await disconnectDb();
});

async function importActions() {
  return await import("./actions");
}

describe("api-key actions — 인증", () => {
  it("세션 없으면 issueApiKeyAction → redirect", async () => {
    mockNoSession();
    const { issueApiKeyAction } = await importActions();
    await expect(issueApiKeyAction("ci-key")).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("세션 없으면 revokeApiKeyAction → redirect", async () => {
    mockNoSession();
    const { revokeApiKeyAction } = await importActions();
    await expect(revokeApiKeyAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("issueApiKeyAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("평문을 1회 반환하고, DB 엔 해시+prefix 만 저장한다 (평문 미저장)", async () => {
    const { issueApiKeyAction } = await importActions();
    const result = await issueApiKeyAction("ci-key");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.plaintext).toBe("string");
    expect(result.plaintext.length).toBeGreaterThan(0);

    const row = await testDb.apiKey.findUnique({
      where: { id: result.apiKey.id },
    });
    // 평문은 저장되지 않고, keyHash 는 평문의 sha256 이어야 한다.
    expect(row?.keyHash).toBe(hashApiKey(result.plaintext));
    expect(row?.keyHash).not.toBe(result.plaintext);
    // prefix 는 저장되며 평문의 앞부분과 일치한다.
    expect(row?.keyPrefix).toBeTruthy();
    expect(result.plaintext.startsWith(row!.keyPrefix)).toBe(true);
    expect(row?.name).toBe("ci-key");
  });

  it("빈 이름 → 검증 에러", async () => {
    const { issueApiKeyAction } = await importActions();
    const result = await issueApiKeyAction("");
    expect(result.ok).toBe(false);
  });

  it("공백 이름 → 검증 에러", async () => {
    const { issueApiKeyAction } = await importActions();
    const result = await issueApiKeyAction("   ");
    expect(result.ok).toBe(false);
  });
});

describe("revokeApiKeyAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("폐기 후 findActiveByHash 가 null (가드가 거부)", async () => {
    const { issueApiKeyAction, revokeApiKeyAction } = await importActions();
    const issued = await issueApiKeyAction("to-revoke");
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const hash = hashApiKey(issued.plaintext);
    expect(await findActiveByHash(hash)).not.toBeNull();

    const result = await revokeApiKeyAction(issued.apiKey.id);
    expect(result.ok).toBe(true);
    expect(await findActiveByHash(hash)).toBeNull();
  });
});
