/**
 * `/admin/series/actions.ts` 통합 테스트.
 *
 * 검증:
 *  - 인증 가드 (세션 없으면 redirect)
 *  - createSeriesAction: 성공 / slug 중복 / 빈 옵셔널 → null / 형식 위반
 *  - updateSeriesAction: 성공 / not-found / slug 중복 / 잘못된 id
 *  - deleteSeriesAction: 성공 / not-found / 연결된 Work 는 detach
 *  - revalidatePath('/admin/series') 와 '/admin/works' 호출
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
import { createSeries } from "@/test/factories/series";
import { createWorkRow } from "@/test/factories/work";
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

// =====================================================================
// 인증
// =====================================================================

describe("series actions — 인증", () => {
  it("세션 없으면 createSeriesAction → redirect", async () => {
    mockNoSession();
    const { createSeriesAction } = await importActions();
    await expect(
      createSeriesAction({
        slug: "lv",
        nameKo: "러브라이브",
        nameJp: "ラブライブ!",
      })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("세션 없으면 updateSeriesAction → redirect", async () => {
    mockNoSession();
    const { updateSeriesAction } = await importActions();
    await expect(updateSeriesAction(1, { nameKo: "x" })).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("세션 없으면 deleteSeriesAction → redirect", async () => {
    mockNoSession();
    const { deleteSeriesAction } = await importActions();
    await expect(deleteSeriesAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

// =====================================================================
// createSeriesAction
// =====================================================================

describe("createSeriesAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("필수 + 옵션 필드 모두 채워 생성 → { ok: true, series }", async () => {
    const { createSeriesAction } = await importActions();
    const result = await createSeriesAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
      nameEn: "Love Live!",
      logoUrl: "https://example.com/logo.png",
      description: "시리즈 설명",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.slug).toBe("love-live");
    expect(result.series.nameEn).toBe("Love Live!");
  });

  it("옵션 필드를 빈 문자열로 보내면 DB 에는 null 저장", async () => {
    const { createSeriesAction } = await importActions();
    const result = await createSeriesAction({
      slug: "bandori",
      nameKo: "뱅드림",
      nameJp: "バンドリ!",
      nameEn: "",
      logoUrl: "",
      description: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.nameEn).toBeNull();
    expect(result.series.logoUrl).toBeNull();
    expect(result.series.description).toBeNull();
  });

  it("slug 중복 (P2002) → fieldErrors.slug", async () => {
    await createSeries({ slug: "love-live" });
    const { createSeriesAction } = await importActions();
    const result = await createSeriesAction({
      slug: "love-live",
      nameKo: "러브라이브 2",
      nameJp: "ラブライブ 2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("필수 필드 누락 (nameKo 빈값) → fieldErrors.nameKo", async () => {
    const { createSeriesAction } = await importActions();
    const result = await createSeriesAction({
      slug: "love-live",
      nameKo: "",
      nameJp: "ラブライブ!",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.nameKo).toBeDefined();
  });

  it("slug 형식 위반 → fieldErrors.slug", async () => {
    const { createSeriesAction } = await importActions();
    const result = await createSeriesAction({
      slug: "Love Live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug).toBeDefined();
  });

  it("성공 시 revalidatePath('/admin/series') 와 '/admin/works' 호출", async () => {
    const { createSeriesAction } = await importActions();
    await createSeriesAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/series");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
  });
});

// =====================================================================
// updateSeriesAction
// =====================================================================

describe("updateSeriesAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("부분 update → 다른 필드 보존", async () => {
    const series = await createSeries({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
    });
    const { updateSeriesAction } = await importActions();
    const result = await updateSeriesAction(series.id, {
      nameKo: "러브라이브 (수정)",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.nameKo).toBe("러브라이브 (수정)");
    expect(result.series.slug).toBe("love-live");
  });

  it("logoUrl 을 빈 문자열로 → null 저장", async () => {
    const series = await createSeries({
      logoUrl: "https://example.com/logo.png",
    });
    const { updateSeriesAction } = await importActions();
    const result = await updateSeriesAction(series.id, { logoUrl: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.series.logoUrl).toBeNull();
  });

  it("not-found seriesId → { ok: false, error }", async () => {
    const { updateSeriesAction } = await importActions();
    const result = await updateSeriesAction(99999, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("유효하지 않은 seriesId (음수) → { ok: false, error }", async () => {
    const { updateSeriesAction } = await importActions();
    const result = await updateSeriesAction(-1, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("slug 중복 (P2002) → fieldErrors.slug", async () => {
    await createSeries({ slug: "love-live" });
    const other = await createSeries({ slug: "bandori" });
    const { updateSeriesAction } = await importActions();
    const result = await updateSeriesAction(other.id, { slug: "love-live" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const series = await createSeries();
    const { updateSeriesAction } = await importActions();
    await updateSeriesAction(series.id, { nameKo: "수정됨" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/series");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
  });
});

// =====================================================================
// deleteSeriesAction
// =====================================================================

describe("deleteSeriesAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("정상 삭제 → { ok: true }, DB 에서 제거", async () => {
    const series = await createSeries();
    const { deleteSeriesAction } = await importActions();
    const result = await deleteSeriesAction(series.id);

    expect(result.ok).toBe(true);
    const reloaded = await testDb.series.findUnique({
      where: { id: series.id },
    });
    expect(reloaded).toBeNull();
  });

  it("연결된 Work 는 detach 됨 (seriesId → null)", async () => {
    const series = await createSeries();
    const work = await createWorkRow({ seriesId: series.id });

    const { deleteSeriesAction } = await importActions();
    const result = await deleteSeriesAction(series.id);

    expect(result.ok).toBe(true);
    const reloaded = await testDb.work.findUnique({
      where: { id: work.id },
    });
    expect(reloaded).not.toBeNull();
    expect(reloaded!.seriesId).toBeNull();
  });

  it("not-found seriesId → { ok: false, error }", async () => {
    const { deleteSeriesAction } = await importActions();
    const result = await deleteSeriesAction(99999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("유효하지 않은 seriesId (0) → { ok: false, error }", async () => {
    const { deleteSeriesAction } = await importActions();
    const result = await deleteSeriesAction(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const series = await createSeries();
    const { deleteSeriesAction } = await importActions();
    await deleteSeriesAction(series.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/series");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
  });
});
