/**
 * `/admin/vendors/actions.ts` 통합 테스트.
 *
 * 검증 대상:
 *  - createVendorAction: 성공 / slug 중복 (P2002) / 필수 필드 / slug 형식 위반
 *  - updateVendorAction: 성공 / not-found / slug 중복
 *  - deleteVendorAction: 성공 / P2003 (TicketSale 참조) → 한국어 메시지
 *  - 모든 액션이 세션 없으면 /admin/login 으로 redirect
 *  - 성공 시 revalidatePath('/admin/vendors') + '/admin/lives' 호출
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
import { createVendorRow } from "@/test/factories/vendor";
import { createLive } from "@/test/factories/live";
import { createTicketSaleRow } from "@/test/factories/ticket-sale";
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

describe("vendor actions — 인증", () => {
  it("세션 없으면 createVendorAction 호출 시 redirect", async () => {
    mockNoSession();
    const { createVendorAction } = await importActions();
    await expect(
      createVendorAction({ slug: "ee-plus", name: "イープラス" })
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("세션 없으면 updateVendorAction 호출 시 redirect", async () => {
    mockNoSession();
    const { updateVendorAction } = await importActions();
    await expect(updateVendorAction(1, { name: "x" })).rejects.toThrow(
      /NEXT_REDIRECT/
    );
  });

  it("세션 없으면 deleteVendorAction 호출 시 redirect", async () => {
    mockNoSession();
    const { deleteVendorAction } = await importActions();
    await expect(deleteVendorAction(1)).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

// =====================================================================
// createVendorAction
// =====================================================================

describe("createVendorAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("필수 + 옵션 필드 모두 채워 생성 → { ok: true, vendor }", async () => {
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "ee-plus",
      name: "イープラス",
      baseUrl: "https://eplus.jp",
      notes: "선행 라운드 단골",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vendor.slug).toBe("ee-plus");
    expect(result.vendor.name).toBe("イープラス");
    expect(result.vendor.baseUrl).toBe("https://eplus.jp");
    expect(result.vendor.notes).toBe("선행 라운드 단골");
  });

  it("옵션 필드를 빈 문자열로 보내면 DB 에는 null 저장", async () => {
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "lawson-ticket",
      name: "ローソンチケット",
      baseUrl: "",
      logoUrl: "",
      notes: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vendor.baseUrl).toBeNull();
    expect(result.vendor.logoUrl).toBeNull();
    expect(result.vendor.notes).toBeNull();
  });

  it("slug 중복 (P2002) → fieldErrors.slug", async () => {
    await createVendorRow({ slug: "ee-plus" });
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "ee-plus",
      name: "イープラス 2",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("필수 필드 누락 (name 빈값) → fieldErrors.name", async () => {
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "ee-plus",
      name: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("slug 형식 위반 (대문자/공백 포함) → fieldErrors.slug", async () => {
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "EE Plus",
      name: "イープラス",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug).toBeDefined();
  });

  it("baseUrl 형식 위반 → fieldErrors.baseUrl", async () => {
    const { createVendorAction } = await importActions();
    const result = await createVendorAction({
      slug: "ee-plus",
      name: "イープラス",
      baseUrl: "not-a-url",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.baseUrl).toBeDefined();
  });

  it("성공 시 revalidatePath('/admin/vendors') 와 '/admin/lives' 호출", async () => {
    const { createVendorAction } = await importActions();
    await createVendorAction({
      slug: "ee-plus",
      name: "イープラス",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vendors");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

// =====================================================================
// updateVendorAction
// =====================================================================

describe("updateVendorAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("부분 update → { ok: true, vendor } + 다른 필드 보존", async () => {
    const vendor = await createVendorRow({
      slug: "ee-plus",
      name: "イープラス",
      baseUrl: "https://eplus.jp",
    });
    const { updateVendorAction } = await importActions();
    const result = await updateVendorAction(vendor.id, {
      name: "이플러스 (수정)",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vendor.name).toBe("이플러스 (수정)");
    expect(result.vendor.slug).toBe("ee-plus");
    expect(result.vendor.baseUrl).toBe("https://eplus.jp");
  });

  it("baseUrl 을 빈 문자열로 → null 저장", async () => {
    const vendor = await createVendorRow({
      baseUrl: "https://example.com",
    });
    const { updateVendorAction } = await importActions();
    const result = await updateVendorAction(vendor.id, { baseUrl: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vendor.baseUrl).toBeNull();
  });

  it("not-found vendorId → { ok: false, error }", async () => {
    const { updateVendorAction } = await importActions();
    const result = await updateVendorAction(99999, { name: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("유효하지 않은 vendorId (음수) → { ok: false, error }", async () => {
    const { updateVendorAction } = await importActions();
    const result = await updateVendorAction(-1, { name: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("slug 중복 (P2002) → fieldErrors.slug", async () => {
    await createVendorRow({ slug: "ee-plus" });
    const other = await createVendorRow({ slug: "lawson-ticket" });
    const { updateVendorAction } = await importActions();
    const result = await updateVendorAction(other.id, { slug: "ee-plus" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.slug?.[0]).toMatch(/이미 사용 중인 slug/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const vendor = await createVendorRow();
    const { updateVendorAction } = await importActions();
    await updateVendorAction(vendor.id, { name: "수정됨" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vendors");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});

// =====================================================================
// deleteVendorAction
// =====================================================================

describe("deleteVendorAction", () => {
  beforeEach(async () => {
    await mockAdminSession();
  });

  it("참조되지 않는 vendor → { ok: true }, DB 에서 제거", async () => {
    const vendor = await createVendorRow();
    const { deleteVendorAction } = await importActions();
    const result = await deleteVendorAction(vendor.id);

    expect(result.ok).toBe(true);
    const reloaded = await testDb.vendor.findUnique({
      where: { id: vendor.id },
    });
    expect(reloaded).toBeNull();
  });

  it("TicketSale 가 참조 중 (P2003) → '사용 중인 발매처는 삭제할 수 없습니다.'", async () => {
    const vendor = await createVendorRow();
    const live = await createLive();
    await createTicketSaleRow(live.id, vendor.id);

    const { deleteVendorAction } = await importActions();
    const result = await deleteVendorAction(vendor.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/사용 중인 발매처는 삭제할 수 없습니다/);

    // 실제로 row 가 남아있음
    const reloaded = await testDb.vendor.findUnique({
      where: { id: vendor.id },
    });
    expect(reloaded).not.toBeNull();
  });

  it("not-found vendorId → { ok: false, error }", async () => {
    const { deleteVendorAction } = await importActions();
    const result = await deleteVendorAction(99999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeDefined();
  });

  it("유효하지 않은 vendorId (0) → { ok: false, error }", async () => {
    const { deleteVendorAction } = await importActions();
    const result = await deleteVendorAction(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/유효하지 않은/);
  });

  it("성공 시 revalidatePath 호출", async () => {
    const vendor = await createVendorRow();
    const { deleteVendorAction } = await importActions();
    await deleteVendorAction(vendor.id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/vendors");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/lives");
  });
});
