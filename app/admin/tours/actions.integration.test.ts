/**
 * `/admin/tours/actions.ts` 통합 테스트.
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
import { createWorkRow } from "@/test/factories/work";
import { createTour } from "@/test/factories/tour";
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

describe("tour actions — 인증", () => {
  it("세션 없으면 createTourAction → redirect", async () => {
    mockNoSession();
    const { createTourAction } = await importActions();
    await expect(
      createTourAction({
        workId: 1,
        slug: "tour-x",
        nameKo: "투어",
        nameJp: "ツアー",
      })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("세션 없으면 updateTourAction → redirect", async () => {
    mockNoSession();
    const { updateTourAction } = await importActions();
    await expect(updateTourAction(1, { nameKo: "x" })).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("세션 없으면 deleteTourAction → redirect", async () => {
    mockNoSession();
    const { deleteTourAction } = await importActions();
    await expect(deleteTourAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("createTourAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("기본 생성 (status DRAFT)", async () => {
    const w = await createWorkRow();
    const { createTourAction } = await importActions();
    const result = await createTourAction({
      workId: w.id,
      slug: "tour-a",
      nameKo: "투어 A",
      nameJp: "ツアー A",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tour.status).toBe("DRAFT");
    expect(result.tour.startsAt).toBeNull();
  });

  it("JST datetime-local → UTC Date 변환", async () => {
    const w = await createWorkRow();
    const { createTourAction } = await importActions();
    const result = await createTourAction({
      workId: w.id,
      slug: "tour-jst",
      nameKo: "JST 투어",
      nameJp: "JST ツアー",
      // JST 2026-08-20 18:30 = UTC 2026-08-20 09:30
      startsAtJst: "2026-08-20T18:30",
      endsAtJst: "2026-11-08T16:30",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tour.startsAt?.toISOString()).toBe("2026-08-20T09:30:00.000Z");
    expect(result.tour.endsAt?.toISOString()).toBe("2026-11-08T07:30:00.000Z");
  });

  it("존재하지 않는 workId → fieldErrors.workId", async () => {
    const { createTourAction } = await importActions();
    const result = await createTourAction({
      workId: 99999,
      slug: "orphan",
      nameKo: "고아",
      nameJp: "孤児",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.workId).toBeDefined();
  });

  it("slug 중복 → fieldErrors.slug", async () => {
    const w = await createWorkRow();
    await createTour({ workId: w.id, slug: "dup-tour" });
    const { createTourAction } = await importActions();
    const result = await createTourAction({
      workId: w.id,
      slug: "dup-tour",
      nameKo: "중복",
      nameJp: "重複",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const w = await createWorkRow();
    const { createTourAction } = await importActions();
    await createTourAction({
      workId: w.id,
      slug: "tour-rv",
      nameKo: "RV",
      nameJp: "RV",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/tours");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

describe("updateTourAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("부분 update", async () => {
    const w = await createWorkRow();
    const t = await createTour({ workId: w.id });
    const { updateTourAction } = await importActions();
    const result = await updateTourAction(t.id, { nameKo: "수정됨" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tour.nameKo).toBe("수정됨");
  });

  it("status DRAFT → PUBLISHED 전환", async () => {
    const w = await createWorkRow();
    const t = await createTour({ workId: w.id });
    const { updateTourAction } = await importActions();
    const result = await updateTourAction(t.id, { status: "PUBLISHED" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tour.status).toBe("PUBLISHED");
  });

  it("not-found id → error", async () => {
    const { updateTourAction } = await importActions();
    const result = await updateTourAction(99999, { nameKo: "x" });
    expect(result.ok).toBe(false);
  });

  it("유효하지 않은 id → error", async () => {
    const { updateTourAction } = await importActions();
    const result = await updateTourAction(-1, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("slug 중복 → fieldErrors.slug", async () => {
    const w = await createWorkRow();
    await createTour({ workId: w.id, slug: "first-tour" });
    const t2 = await createTour({ workId: w.id, slug: "second-tour" });
    const { updateTourAction } = await importActions();
    const result = await updateTourAction(t2.id, { slug: "first-tour" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });
});

describe("deleteTourAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("정상 삭제", async () => {
    const w = await createWorkRow();
    const t = await createTour({ workId: w.id });
    const { deleteTourAction } = await importActions();
    const result = await deleteTourAction(t.id);
    expect(result.ok).toBe(true);
    const r = await testDb.tour.findUnique({ where: { id: t.id } });
    expect(r).toBeNull();
  });

  it("not-found → error", async () => {
    const { deleteTourAction } = await importActions();
    const result = await deleteTourAction(99999);
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath", async () => {
    const w = await createWorkRow();
    const t = await createTour({ workId: w.id });
    const { deleteTourAction } = await importActions();
    await deleteTourAction(t.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/tours");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});
