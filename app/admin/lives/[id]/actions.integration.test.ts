/**
 * `/admin/lives/[id]/actions.ts` 통합 테스트 (RED — 구현 전).
 *
 * 검증 대상:
 *  - updateLiveHeaderAction(liveId, input): partial update + 자동저장 응답 형식
 *  - publishLiveAction(liveId)  : DRAFT → PUBLISHED (헤더 게이트 검증)
 *  - unpublishLiveAction(liveId): PUBLISHED → DRAFT (무조건 성공)
 *
 * 본 사이클 한정 가정 (TODO.md):
 *  - publishLiveAction 의 게이트는 헤더 필수 필드만 검증 (LiveBand 검증 생략).
 *  - 다음 사이클에서 활성화 — TODO 주석으로 명시.
 *
 * 응답 형식:
 *  - update 성공: { ok: true, savedAt: ISO string }
 *  - update 실패: { ok: false, error, fieldErrors? }
 *  - publish 성공: { ok: true }
 *  - publish 실패: { ok: false, gateFailures: string[] }
 *
 * 모든 mutation 후 revalidatePath("/admin/lives") 호출.
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
import { createLive } from "@/test/factories/live";
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

describe("updateLiveHeaderAction — 인증", () => {
  it("세션 없으면 /admin/login 으로 redirect", async () => {
    mockNoSession();
    const { updateLiveHeaderAction } = await importActions();
    await expect(
      updateLiveHeaderAction(1, { titleKo: "x" })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });
});

describe("updateLiveHeaderAction — 부분 업데이트", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("titleKo 만 변경 → 다른 필드는 보존", async () => {
    const live = await createLive({ titleKo: "원래", titleJp: "原" });
    const { updateLiveHeaderAction } = await importActions();
    const result = await updateLiveHeaderAction(live.id, {
      titleKo: "수정됨",
    });

    expect(result).toMatchObject({ ok: true });
    expect((result as { savedAt: string }).savedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );

    const reloaded = await testDb.live.findUnique({ where: { id: live.id } });
    expect(reloaded!.titleKo).toBe("수정됨");
    expect(reloaded!.titleJp).toBe("原");
  });

  it("startAtJst 변경 시 UTC 로 정확히 변환", async () => {
    const live = await createLive();
    const { updateLiveHeaderAction } = await importActions();
    const result = await updateLiveHeaderAction(live.id, {
      startAtJst: "2026-04-01T19:30",
    });
    expect((result as { ok: boolean }).ok).toBe(true);

    const reloaded = await testDb.live.findUnique({ where: { id: live.id } });
    // JST 2026-04-01 19:30 = UTC 2026-04-01 10:30
    expect(reloaded!.startAt.toISOString()).toBe("2026-04-01T10:30:00.000Z");
  });

  it("형식 오류 입력 시 { ok: false, fieldErrors }", async () => {
    const live = await createLive();
    const { updateLiveHeaderAction } = await importActions();
    const result = await updateLiveHeaderAction(live.id, {
      startAtJst: "2026-03-15 18:00", // 공백
    });

    expect(result).toMatchObject({ ok: false });
    expect((result as { fieldErrors: Record<string, unknown> }).fieldErrors)
      .toHaveProperty("startAtJst");
  });

  it("성공 시 revalidatePath('/admin/lives') 호출", async () => {
    const live = await createLive();
    const { updateLiveHeaderAction } = await importActions();
    await updateLiveHeaderAction(live.id, { titleKo: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });

  it("soft-deleted 라이브 update 시도 → { ok: false, error }", async () => {
    const live = await createLive();
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { updateLiveHeaderAction } = await importActions();
    const result = await updateLiveHeaderAction(live.id, { titleKo: "x" });
    expect(result).toMatchObject({ ok: false });
  });

  it("savedAt 가 ISO 8601 형식의 최신 timestamp (stale-guard 클라이언트 보조용)", async () => {
    const live = await createLive();
    const { updateLiveHeaderAction } = await importActions();

    const before = Date.now();
    const result = await updateLiveHeaderAction(live.id, { titleKo: "x" });
    const after = Date.now();

    expect(result).toMatchObject({ ok: true });
    const savedAt = new Date(
      (result as { savedAt: string }).savedAt
    ).getTime();
    expect(savedAt).toBeGreaterThanOrEqual(before);
    expect(savedAt).toBeLessThanOrEqual(after + 1000);
  });
});

describe("publishLiveAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { publishLiveAction } = await importActions();
    await expect(publishLiveAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("헤더 필수 필드 모두 충족 + DRAFT → PUBLISHED 전환, { ok: true }", async () => {
    const live = await createLive({ status: "DRAFT" });

    const { publishLiveAction } = await importActions();
    const result = await publishLiveAction(live.id);

    expect(result).toMatchObject({ ok: true });
    const reloaded = await testDb.live.findUnique({ where: { id: live.id } });
    expect(reloaded!.status).toBe("PUBLISHED");
  });

  it("venueName 빈값 → { ok: false, gateFailures: ['venueName'] }", async () => {
    const live = await createLive({ status: "DRAFT", venueName: "" });
    const { publishLiveAction } = await importActions();
    const result = await publishLiveAction(live.id);

    expect(result).toMatchObject({ ok: false });
    expect((result as { gateFailures: string[] }).gateFailures).toContain(
      "venueName"
    );
    // 상태는 변경되지 않음
    const reloaded = await testDb.live.findUnique({ where: { id: live.id } });
    expect(reloaded!.status).toBe("DRAFT");
  });

  it("titleEn 비어있어도 공개 가능 (optional)", async () => {
    const live = await createLive({ status: "DRAFT", titleEn: null });
    const { publishLiveAction } = await importActions();
    const result = await publishLiveAction(live.id);
    expect(result).toMatchObject({ ok: true });
  });

  it("성공 시 revalidatePath('/admin/lives') 호출", async () => {
    const live = await createLive({ status: "DRAFT" });
    const { publishLiveAction } = await importActions();
    await publishLiveAction(live.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });

  it("본 사이클 한정: LiveBand 없어도 공개 가능 (다음 사이클에서 활성화)", async () => {
    // 본 사이클은 LiveBand 검증 생략 — 명시적 가정.
    const live = await createLive({ status: "DRAFT" });
    const bands = await testDb.liveBand.findMany({ where: { liveId: live.id } });
    expect(bands).toEqual([]);

    const { publishLiveAction } = await importActions();
    const result = await publishLiveAction(live.id);
    expect(result).toMatchObject({ ok: true });
  });
});

describe("unpublishLiveAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("세션 없으면 redirect", async () => {
    mockNoSession();
    const { unpublishLiveAction } = await importActions();
    await expect(unpublishLiveAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("PUBLISHED → DRAFT 전환", async () => {
    const live = await createLive({ status: "PUBLISHED" });
    const { unpublishLiveAction } = await importActions();
    const result = await unpublishLiveAction(live.id);
    expect(result).toMatchObject({ ok: true });

    const reloaded = await testDb.live.findUnique({ where: { id: live.id } });
    expect(reloaded!.status).toBe("DRAFT");
  });

  it("DRAFT 라이브 호출 (idempotent) — { ok: true } 유지", async () => {
    const live = await createLive({ status: "DRAFT" });
    const { unpublishLiveAction } = await importActions();
    const result = await unpublishLiveAction(live.id);
    expect(result).toMatchObject({ ok: true });
  });

  it("성공 시 revalidatePath('/admin/lives') 호출", async () => {
    const live = await createLive({ status: "PUBLISHED" });
    const { unpublishLiveAction } = await importActions();
    await unpublishLiveAction(live.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});
