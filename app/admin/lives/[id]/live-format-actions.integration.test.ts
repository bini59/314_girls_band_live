/**
 * `/admin/lives/[id]/live-format-actions.ts` 통합 테스트.
 *
 * 검증 대상:
 *  - createLiveFormatAction(liveId, input)
 *  - updateLiveFormatAction(formatId, patch)
 *  - deleteLiveFormatAction(formatId)
 *
 * 보안 가드:
 *  - 모든 액션은 requireAdminSession 통과 필요.
 *  - update/delete 는 대상 LiveFormat 의 소속 Live 가 soft-deleted 면 거부.
 *  - 잘못된 ID (cross-live, non-existent) 는 거부.
 *
 * 데이터:
 *  - 빈 문자열 optional → null 로 정규화.
 *  - delete 는 cascade (TicketTier 동반 삭제).
 *  - mutation 성공 시 revalidatePath('/admin/lives/{liveId}') 호출.
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
import { createLiveFormatRow } from "@/test/factories/live-format";
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
  return await import("./live-format-actions");
}

describe("createLiveFormatAction — 인증", () => {
  it("세션 없으면 /admin/login 으로 redirect", async () => {
    mockNoSession();
    const { createLiveFormatAction } = await importActions();
    await expect(
      createLiveFormatAction(1, { type: "LIVE_VENUE" })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });
});

describe("createLiveFormatAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("happy path — 포맷 1건 생성 + format 반환", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      type: "LIVE_VIEWING",
      label: "전국 5관 LV",
      venueName: "TOHO 시네마즈",
      url: "https://example.com/lv",
    });

    expect(result).toMatchObject({ ok: true });
    const format = (result as { format: { id: number } }).format;
    expect(format).toBeDefined();
    expect(format.id).toBeGreaterThan(0);

    const row = await testDb.liveFormat.findUnique({
      where: { id: format.id },
    });
    expect(row).not.toBeNull();
    expect(row!.type).toBe("LIVE_VIEWING");
    expect(row!.label).toBe("전국 5관 LV");
    expect(row!.venueName).toBe("TOHO 시네마즈");
    expect(row!.url).toBe("https://example.com/lv");
  });

  it("invalid type 거부 (fieldErrors.type)", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      // @ts-expect-error 잘못된 타입을 강제로 전달
      type: "INVALID_TYPE",
    });
    expect(result).toMatchObject({ ok: false });
    expect(
      (result as { fieldErrors: Record<string, unknown> }).fieldErrors
    ).toHaveProperty("type");
    expect(await testDb.liveFormat.count()).toBe(0);
  });

  it("url 형식 위반 → fieldErrors.url", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      type: "STREAMING",
      url: "not-a-url",
    });
    expect(result).toMatchObject({ ok: false });
    expect(
      (result as { fieldErrors: Record<string, unknown> }).fieldErrors
    ).toHaveProperty("url");
  });

  it("label 200자 초과 → fieldErrors.label", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      type: "LIVE_VENUE",
      label: "x".repeat(201),
    });
    expect(result).toMatchObject({ ok: false });
    expect(
      (result as { fieldErrors: Record<string, unknown> }).fieldErrors
    ).toHaveProperty("label");
  });

  it("존재하지 않는 liveId → { ok: false }", async () => {
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(99999, {
      type: "LIVE_VENUE",
    });
    expect(result).toMatchObject({ ok: false });
    expect(await testDb.liveFormat.count()).toBe(0);
  });

  it("soft-deleted Live 의 포맷 추가 거부", async () => {
    const live = await createLive();
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      type: "LIVE_VENUE",
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("빈 문자열 optional 필드 → null 로 정규화", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    const result = await createLiveFormatAction(live.id, {
      type: "LIVE_VENUE",
      label: "",
      venueName: "",
      url: "",
    });
    expect(result).toMatchObject({ ok: true });
    const format = (result as { format: { id: number } }).format;
    const row = await testDb.liveFormat.findUnique({
      where: { id: format.id },
    });
    expect(row!.label).toBeNull();
    expect(row!.venueName).toBeNull();
    expect(row!.url).toBeNull();
  });

  it("성공 시 revalidatePath('/admin/lives/{liveId}') 호출", async () => {
    const live = await createLive();
    const { createLiveFormatAction } = await importActions();
    await createLiveFormatAction(live.id, { type: "LIVE_VENUE" });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/lives/${live.id}`
    );
  });
});

describe("updateLiveFormatAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("happy path — label 갱신", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id, { label: "원본" });

    const { updateLiveFormatAction } = await importActions();
    const result = await updateLiveFormatAction(fmt.id, { label: "수정됨" });
    expect(result).toMatchObject({ ok: true });

    const row = await testDb.liveFormat.findUnique({ where: { id: fmt.id } });
    expect(row!.label).toBe("수정됨");
  });

  it("존재하지 않는 formatId → { ok: false }", async () => {
    const { updateLiveFormatAction } = await importActions();
    const result = await updateLiveFormatAction(99999, { label: "x" });
    expect(result).toMatchObject({ ok: false });
  });

  it("soft-deleted Live 의 포맷 update 거부", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { updateLiveFormatAction } = await importActions();
    const result = await updateLiveFormatAction(fmt.id, { label: "x" });
    expect(result).toMatchObject({ ok: false });
  });

  it("cross-live 시도 거부 — 다른 live 의 format 만으로는 영향 없음", async () => {
    const liveA = await createLive();
    const liveB = await createLive();
    const fmtA = await createLiveFormatRow(liveA.id, { label: "A" });
    const fmtB = await createLiveFormatRow(liveB.id, { label: "B" });

    // fmtB 만 update — revalidatePath 는 liveB 경로여야 함.
    const { updateLiveFormatAction } = await importActions();
    const result = await updateLiveFormatAction(fmtB.id, { label: "B-수정" });
    expect(result).toMatchObject({ ok: true });

    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/lives/${liveB.id}`
    );
    // fmtA 는 변경되지 않음.
    const a = await testDb.liveFormat.findUnique({ where: { id: fmtA.id } });
    expect(a!.label).toBe("A");
  });

  it("빈 문자열 optional → null", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id, {
      label: "원본",
      url: "https://example.com",
    });
    const { updateLiveFormatAction } = await importActions();
    const result = await updateLiveFormatAction(fmt.id, {
      label: "",
      url: "",
    });
    expect(result).toMatchObject({ ok: true });
    const row = await testDb.liveFormat.findUnique({ where: { id: fmt.id } });
    expect(row!.label).toBeNull();
    expect(row!.url).toBeNull();
  });

  it("성공 시 revalidatePath 호출", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const { updateLiveFormatAction } = await importActions();
    await updateLiveFormatAction(fmt.id, { label: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/lives/${live.id}`
    );
  });
});

describe("deleteLiveFormatAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("happy path — 포맷 삭제", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const { deleteLiveFormatAction } = await importActions();
    const result = await deleteLiveFormatAction(fmt.id);
    expect(result).toMatchObject({ ok: true });

    const row = await testDb.liveFormat.findUnique({ where: { id: fmt.id } });
    expect(row).toBeNull();
  });

  it("존재하지 않는 formatId → { ok: false }", async () => {
    const { deleteLiveFormatAction } = await importActions();
    const result = await deleteLiveFormatAction(99999);
    expect(result).toMatchObject({ ok: false });
  });

  it("soft-deleted Live 의 포맷 삭제 거부", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    await testDb.live.update({
      where: { id: live.id },
      data: { deletedAt: new Date() },
    });

    const { deleteLiveFormatAction } = await importActions();
    const result = await deleteLiveFormatAction(fmt.id);
    expect(result).toMatchObject({ ok: false });
    // row 는 아직 존재해야 함.
    const row = await testDb.liveFormat.findUnique({ where: { id: fmt.id } });
    expect(row).not.toBeNull();
  });

  it("cross-live 안전성 — fmtB 삭제 시 fmtA 는 그대로", async () => {
    const liveA = await createLive();
    const liveB = await createLive();
    const fmtA = await createLiveFormatRow(liveA.id);
    const fmtB = await createLiveFormatRow(liveB.id);

    const { deleteLiveFormatAction } = await importActions();
    const result = await deleteLiveFormatAction(fmtB.id);
    expect(result).toMatchObject({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/lives/${liveB.id}`
    );

    expect(
      await testDb.liveFormat.findUnique({ where: { id: fmtA.id } })
    ).not.toBeNull();
    expect(
      await testDb.liveFormat.findUnique({ where: { id: fmtB.id } })
    ).toBeNull();
  });

  it("cascade — TicketTier 도 함께 삭제", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await testDb.ticketTier.create({
      data: {
        formatId: fmt.id,
        name: "SS",
        priceJpy: 12000,
        order: 0,
      },
    });

    const { deleteLiveFormatAction } = await importActions();
    const result = await deleteLiveFormatAction(fmt.id);
    expect(result).toMatchObject({ ok: true });

    const gone = await testDb.ticketTier.findUnique({
      where: { id: tier.id },
    });
    expect(gone).toBeNull();
  });

  it("성공 시 revalidatePath 호출", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const { deleteLiveFormatAction } = await importActions();
    await deleteLiveFormatAction(fmt.id);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/admin/lives/${live.id}`
    );
  });
});
