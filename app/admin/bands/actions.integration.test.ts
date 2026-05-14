/**
 * `/admin/bands/actions.ts` 통합 테스트.
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
import { createBand, createWork } from "@/test/factories/band";
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

describe("band actions — 인증", () => {
  it("세션 없으면 createBandAction → redirect", async () => {
    mockNoSession();
    const { createBandAction } = await importActions();
    await expect(
      createBandAction({
        workId: 1,
        slug: "mygo",
        nameKo: "마이고",
        nameJp: "MyGO!!!!!",
      })
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("세션 없으면 updateBandAction → redirect", async () => {
    mockNoSession();
    const { updateBandAction } = await importActions();
    await expect(updateBandAction(1, { nameKo: "x" })).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("세션 없으면 deleteBandAction → redirect", async () => {
    mockNoSession();
    const { deleteBandAction } = await importActions();
    await expect(deleteBandAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("createBandAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("정상 생성", async () => {
    const w = await createWork();
    const { createBandAction } = await importActions();
    const result = await createBandAction({
      workId: w.id,
      slug: "mygo",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.workId).toBe(w.id);
    expect(result.band.snsLinks).toBeNull();
  });

  it("snsLinks 객체 → DB 라운드트립", async () => {
    const w = await createWork();
    const { createBandAction } = await importActions();
    const result = await createBandAction({
      workId: w.id,
      slug: "mygo-sns",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
      snsLinks: {
        twitter: "https://twitter.com/mygo",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.snsLinks).toEqual({
      twitter: "https://twitter.com/mygo",
    });
  });

  it("snsLinks 빈 객체 → DB null 저장", async () => {
    const w = await createWork();
    const { createBandAction } = await importActions();
    const result = await createBandAction({
      workId: w.id,
      slug: "mygo-empty",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
      snsLinks: {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.snsLinks).toBeNull();
  });

  it("존재하지 않는 workId → fieldErrors.workId", async () => {
    const { createBandAction } = await importActions();
    const result = await createBandAction({
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
    const w = await createWork();
    await createBand({ workId: w.id, slug: "dup-slug" });
    const { createBandAction } = await importActions();
    const result = await createBandAction({
      workId: w.id,
      slug: "dup-slug",
      nameKo: "a",
      nameJp: "a",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("snsLinks 값이 URL 이 아니면 fieldErrors", async () => {
    const w = await createWork();
    const { createBandAction } = await importActions();
    const result = await createBandAction({
      workId: w.id,
      slug: "mygo-bad",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
      snsLinks: { twitter: "not-a-url" },
    });
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath", async () => {
    const w = await createWork();
    const { createBandAction } = await importActions();
    await createBandAction({
      workId: w.id,
      slug: "mygo",
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

describe("updateBandAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("부분 update", async () => {
    const b = await createBand();
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(b.id, { nameKo: "수정됨" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.nameKo).toBe("수정됨");
  });

  it("snsLinks null 로 설정", async () => {
    const b = await createBand();
    await testDb.band.update({
      where: { id: b.id },
      data: { snsLinks: { twitter: "https://twitter.com/x" } },
    });
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(b.id, { snsLinks: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.snsLinks).toBeNull();
  });

  it("snsLinks 빈 객체 → null 로 변환되어 저장", async () => {
    const b = await createBand();
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(b.id, { snsLinks: {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.band.snsLinks).toBeNull();
  });

  it("존재하지 않는 workId → fieldErrors.workId", async () => {
    const b = await createBand();
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(b.id, { workId: 99999 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.workId).toBeDefined();
  });

  it("not-found id → error", async () => {
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(99999, { nameKo: "x" });
    expect(result.ok).toBe(false);
  });

  it("유효하지 않은 id → error", async () => {
    const { updateBandAction } = await importActions();
    const result = await updateBandAction(-1, { nameKo: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("성공 시 revalidatePath", async () => {
    const b = await createBand();
    const { updateBandAction } = await importActions();
    await updateBandAction(b.id, { nameKo: "x" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

describe("deleteBandAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("출연 이력 없는 밴드 → 삭제", async () => {
    const b = await createBand();
    const { deleteBandAction } = await importActions();
    const result = await deleteBandAction(b.id);
    expect(result.ok).toBe(true);
  });

  it("LiveBand 가 참조 중 → '출연 이력'", async () => {
    const band = await createBand();
    const live = await createLive();
    await testDb.liveBand.create({
      data: { liveId: live.id, bandId: band.id },
    });
    const { deleteBandAction } = await importActions();
    const result = await deleteBandAction(band.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/출연 이력/);
  });

  it("not-found → error", async () => {
    const { deleteBandAction } = await importActions();
    const result = await deleteBandAction(99999);
    expect(result.ok).toBe(false);
  });

  it("성공 시 revalidatePath", async () => {
    const b = await createBand();
    const { deleteBandAction } = await importActions();
    await deleteBandAction(b.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bands");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});
