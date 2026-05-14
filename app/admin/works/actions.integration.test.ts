/**
 * `/admin/works/actions.ts` 통합 테스트.
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
import { createBand } from "@/test/factories/band";
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

describe("work actions — 인증", () => {
  it("세션 없으면 createWorkAction → redirect", async () => {
    mockNoSession();
    const { createWorkAction } = await importActions();
    await expect(
      createWorkAction({
        slug: "love-live",
        nameKo: "러브라이브",
        nameJp: "ラブライブ!",
      })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("세션 없으면 updateWorkAction → redirect", async () => {
    mockNoSession();
    const { updateWorkAction } = await importActions();
    await expect(updateWorkAction(1, { nameKo: "x" })).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("세션 없으면 deleteWorkAction → redirect", async () => {
    mockNoSession();
    const { deleteWorkAction } = await importActions();
    await expect(deleteWorkAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("createWorkAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("seriesId 없이 생성", async () => {
    const { createWorkAction } = await importActions();
    const result = await createWorkAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work.seriesId).toBeNull();
  });

  it("seriesId 포함 생성", async () => {
    const s = await createSeries();
    const { createWorkAction } = await importActions();
    const result = await createWorkAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
      seriesId: s.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work.seriesId).toBe(s.id);
  });

  it("존재하지 않는 seriesId → fieldErrors.seriesId", async () => {
    const { createWorkAction } = await importActions();
    const result = await createWorkAction({
      slug: "orphan-work",
      nameKo: "고아",
      nameJp: "孤児",
      seriesId: 99999,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.seriesId).toBeDefined();
  });

  it("옵션 필드 빈 문자열 → DB null", async () => {
    const { createWorkAction } = await importActions();
    const result = await createWorkAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
      nameEn: "",
      kind: "",
      logoUrl: "",
      description: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work.nameEn).toBeNull();
    expect(result.work.kind).toBeNull();
    expect(result.work.logoUrl).toBeNull();
    expect(result.work.description).toBeNull();
  });

  it("slug 중복 → fieldErrors.slug", async () => {
    await createWorkRow({ slug: "love-live" });
    const { createWorkAction } = await importActions();
    const result = await createWorkAction({
      slug: "love-live",
      nameKo: "러브라이브 2",
      nameJp: "ラブライブ 2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const { createWorkAction } = await importActions();
    await createWorkAction({
      slug: "love-live",
      nameKo: "러브라이브",
      nameJp: "ラブライブ!",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
  });
});

describe("updateWorkAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("부분 update", async () => {
    const w = await createWorkRow();
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(w.id, { nameKo: "수정됨" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work.nameKo).toBe("수정됨");
  });

  it("seriesId null 변경", async () => {
    const s = await createSeries();
    const w = await createWorkRow({ seriesId: s.id });
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(w.id, { seriesId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.work.seriesId).toBeNull();
  });

  it("존재하지 않는 seriesId → fieldErrors.seriesId", async () => {
    const w = await createWorkRow();
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(w.id, { seriesId: 99999 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.seriesId).toBeDefined();
  });

  it("not-found id → error", async () => {
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(99999, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("유효하지 않은 id → error", async () => {
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(-1, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("slug 중복 → fieldErrors.slug", async () => {
    const a = await createWorkRow({ slug: "love-live" });
    const b = await createWorkRow({ slug: "bandori" });
    const { updateWorkAction } = await importActions();
    const result = await updateWorkAction(b.id, { slug: a.slug });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("성공 시 revalidatePath", async () => {
    const w = await createWorkRow();
    const { updateWorkAction } = await importActions();
    await updateWorkAction(w.id, { nameKo: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
  });
});

describe("deleteWorkAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("밴드 없는 작품 → 삭제 성공", async () => {
    const w = await createWorkRow();
    const { deleteWorkAction } = await importActions();
    const result = await deleteWorkAction(w.id);
    expect(result.ok).toBe(true);
    const r = await testDb.work.findUnique({ where: { id: w.id } });
    expect(r).toBeNull();
  });

  it("밴드가 있는 작품 → '사용 중인 작품'", async () => {
    const w = await createWorkRow();
    await createBand({ workId: w.id });
    const { deleteWorkAction } = await importActions();
    const result = await deleteWorkAction(w.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/사용 중인 작품/);
  });

  it("not-found → error", async () => {
    const { deleteWorkAction } = await importActions();
    const result = await deleteWorkAction(99999);
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath", async () => {
    const w = await createWorkRow();
    const { deleteWorkAction } = await importActions();
    await deleteWorkAction(w.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/works");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
  });
});
