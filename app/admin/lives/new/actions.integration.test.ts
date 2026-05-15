/**
 * `createLiveHeaderAction` 통합 테스트 (RED — 구현 전).
 *
 * 검증:
 *  - 미인증 호출 → requireAdminSession 이 /admin/login 으로 redirect
 *  - 필수 필드 누락 → `{ ok: false, fieldErrors }` (DB 무변경)
 *  - 성공 시:
 *    · DB 에 status=DRAFT row 추가
 *    · JST datetime-local → UTC 변환 (예: 2026-03-15T18:00 → 2026-03-15T09:00Z)
 *    · slug 자동 생성 (titleEn 우선)
 *    · slug 빈값 + titleEn 없음 → fieldErrors.slug ("직접 입력 필요")
 *    · slug 중복 → suffix `-2`
 *  - 성공 시 revalidatePath("/admin/lives") 호출
 *  - 성공 시 redirect(`/admin/lives/{id}`)
 *
 * mock:
 *  - next/headers: 어드민 세션 쿠키
 *  - next/navigation: redirect (throw 모사)
 *  - next/cache: revalidatePath (call 검증)
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

function makeFormData(
  fields: Record<string, string | undefined>
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) fd.set(k, v);
  }
  return fd;
}

const VALID_FORM = {
  titleKo: "MyGO!!!!! 1주년 라이브",
  titleJp: "MyGO!!!!! 1st ライブ「春の唄」",
  titleEn: "MyGO!!!!! 1st Live",
  type: "SOLO",
  startAtJst: "2026-03-15T18:00",
  venueName: "さいたまスーパーアリーナ",
};

async function callCreate(prev: unknown, fd: FormData) {
  const mod = await import("./actions");
  return await mod.createLiveHeaderAction(prev as never, fd);
}

describe("createLiveHeaderAction — 인증 가드", () => {
  it("세션 없으면 /admin/login 으로 redirect", async () => {
    mockNoSession();
    await expect(
      callCreate(undefined, makeFormData(VALID_FORM))
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });
});

describe("createLiveHeaderAction — 검증 실패", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("titleKo 누락 시 fieldErrors 반환, DB 무변경", async () => {
    const fd = makeFormData({ ...VALID_FORM, titleKo: "" });
    const result = await callCreate(undefined, fd);

    expect(result).toMatchObject({ ok: false });
    expect((result as { fieldErrors: Record<string, unknown> }).fieldErrors)
      .toHaveProperty("titleKo");

    const count = await testDb.live.count();
    expect(count).toBe(0);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("startAtJst 형식 오류 시 fieldErrors", async () => {
    const fd = makeFormData({
      ...VALID_FORM,
      startAtJst: "2026-03-15 18:00", // 공백
    });
    const result = await callCreate(undefined, fd);

    expect(result).toMatchObject({ ok: false });
    expect((result as { fieldErrors: Record<string, unknown> }).fieldErrors)
      .toHaveProperty("startAtJst");
    expect(await testDb.live.count()).toBe(0);
  });

  it("slug 빈값 + titleEn 빈값 → fieldErrors.slug", async () => {
    const fd = makeFormData({
      ...VALID_FORM,
      titleEn: "",
      slug: "",
    });
    const result = await callCreate(undefined, fd);

    expect(result).toMatchObject({ ok: false });
    expect((result as { fieldErrors: Record<string, unknown> }).fieldErrors)
      .toHaveProperty("slug");
    expect(await testDb.live.count()).toBe(0);
  });
});

describe("createLiveHeaderAction — 성공", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("DRAFT 라이브 1건 생성, JST→UTC 변환, redirect 호출", async () => {
    const fd = makeFormData(VALID_FORM);

    let thrown: unknown;
    try {
      await callCreate(undefined, fd);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(redirectMock).toHaveBeenCalledTimes(1);

    const live = await testDb.live.findFirst();
    expect(live).not.toBeNull();
    expect(live!.status).toBe("DRAFT");
    expect(live!.titleKo).toBe(VALID_FORM.titleKo);
    expect(live!.titleJp).toBe(VALID_FORM.titleJp);
    // JST 2026-03-15 18:00 = UTC 2026-03-15 09:00
    expect(live!.startAt.toISOString()).toBe("2026-03-15T09:00:00.000Z");

    // redirect 경로에 새 라이브 id 포함
    expect(redirectMock).toHaveBeenCalledWith(`/admin/lives/${live!.id}`);
  });

  it("성공 시 revalidatePath('/admin/lives') 호출", async () => {
    const fd = makeFormData(VALID_FORM);
    try {
      await callCreate(undefined, fd);
    } catch {
      // redirect throw 무시
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });

  it("slug 빈값 + titleEn 있음 → slugify(titleEn) 자동 생성", async () => {
    const fd = makeFormData({
      ...VALID_FORM,
      titleEn: "MyGO 1st Anniversary",
      slug: "",
    });

    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }

    const live = await testDb.live.findFirst();
    expect(live).not.toBeNull();
    expect(live!.slug).toBe("mygo-1st-anniversary");
  });

  it("slug 직접 지정 시 그대로 사용", async () => {
    const fd = makeFormData({
      ...VALID_FORM,
      slug: "my-custom-slug",
    });
    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }
    const live = await testDb.live.findFirst();
    expect(live!.slug).toBe("my-custom-slug");
  });

  it("slug 중복 시 `-2` suffix 자동 부여", async () => {
    // 첫 생성
    try {
      await callCreate(undefined, makeFormData({ ...VALID_FORM, slug: "dup-slug" }));
    } catch {
      /* redirect */
    }
    redirectMock.mockClear();

    // 두 번째 생성 — 같은 slug
    try {
      await callCreate(undefined, makeFormData({ ...VALID_FORM, slug: "dup-slug" }));
    } catch {
      /* redirect */
    }

    const all = await testDb.live.findMany({ orderBy: { id: "asc" } });
    expect(all.map((l) => l.slug)).toEqual(["dup-slug", "dup-slug-2"]);
  });

  it("createLive 후 기본 LIVE_VENUE LiveFormat 이 자동 생성된다", async () => {
    const fd = makeFormData(VALID_FORM);
    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }

    const live = await testDb.live.findFirst();
    expect(live).not.toBeNull();

    const formats = await testDb.liveFormat.findMany({
      where: { liveId: live!.id },
    });
    expect(formats.length).toBeGreaterThanOrEqual(1);
    const venue = formats.find((f) => f.type === "LIVE_VENUE");
    expect(venue).toBeDefined();
    // venueName 은 Live.venueName 을 복사.
    expect(venue!.venueName).toBe(VALID_FORM.venueName);
  });

  it("posterUrl / thumbnailUrl 이 입력되면 DB 에 저장된다", async () => {
    const fd = makeFormData({
      ...VALID_FORM,
      posterUrl: "https://cdn.example.com/poster.jpg",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    });
    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }
    const live = await testDb.live.findFirst();
    expect(live!.posterUrl).toBe("https://cdn.example.com/poster.jpg");
    expect(live!.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("posterUrl / thumbnailUrl 미입력 시 null 로 저장된다", async () => {
    const fd = makeFormData(VALID_FORM);
    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }
    const live = await testDb.live.findFirst();
    expect(live!.posterUrl).toBeNull();
    expect(live!.thumbnailUrl).toBeNull();
  });

  it("doorsOpenAtJst 가 비어있는 date-only 입력은 fillDefaultTime 으로 18:00 부착", async () => {
    // 단순화: doorsOpenAtJst="2026-03-15" 만 전달 → 18:00 가 부착되어 startAt(18:00) 와 같아지므로
    // 검증 통과를 위해 doorsOpenAt 보다 startAt 을 늦게 잡음 (19:00).
    const fd = makeFormData({
      ...VALID_FORM,
      startAtJst: "2026-03-15T19:00",
      doorsOpenAtJst: "2026-03-15", // 날짜만
    });
    try {
      await callCreate(undefined, fd);
    } catch {
      /* redirect */
    }
    const live = await testDb.live.findFirst();
    expect(live!.doorsOpenAt?.toISOString()).toBe("2026-03-15T09:00:00.000Z");
  });
});
