/**
 * `signOutAction` 통합 테스트 (RED — 구현 전).
 *
 * 검증:
 *  - 세션 쿠키 삭제 (`cookies().delete(SESSION_COOKIE_NAME)`)
 *  - `/admin/login` 으로 redirect
 *
 * 세션 유무는 본 액션의 동작에 영향을 주지 않는다 (멱등 로그아웃).
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

import {
  cookieMocks,
  redirectMock,
  resetAdminSessionMocks,
  TEST_JWT_SECRET,
} from "@/test/helpers/admin-session";

vi.mock("next/headers", () => ({
  cookies: async () => cookieMocks.api,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

beforeEach(() => {
  resetAdminSessionMocks();
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("signOutAction", () => {
  it("세션 쿠키를 만료시키고 /admin/login 으로 redirect", async () => {
    const { signOutAction } = await import("./actions");

    let thrown: unknown;
    try {
      await signOutAction();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");

    // signOutAction 은 발급 시와 동일한 쿠키 옵션으로 maxAge:0 set 한다.
    // (브라우저가 동일 쿠키로 인식해 삭제하도록.)
    expect(cookieMocks.setMock).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookieMocks.setMock.mock.calls[0];
    expect(name).toBe("gbl_session");
    expect(value).toBe("");
    expect(opts).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  it("세션이 없어도 동일하게 동작 (멱등)", async () => {
    cookieMocks.getMock.mockReturnValue(undefined);
    const { signOutAction } = await import("./actions");

    try {
      await signOutAction();
    } catch {
      // redirect throw
    }

    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
    expect(cookieMocks.setMock).toHaveBeenCalled();
  });
});
