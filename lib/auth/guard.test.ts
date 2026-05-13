import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

const TEST_JWT_SECRET =
  "test-secret-test-secret-test-secret-test-secret-32bytes-min";

// next/headers, next/navigation 모킹.
const cookieGetMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGetMock,
  }),
}));

const redirectMock = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

beforeEach(() => {
  cookieGetMock.mockReset();
  redirectMock.mockClear();
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** 테스트 환경의 쿠키 이름. NODE_ENV=test 이면 prefix 없음. */
const COOKIE_NAME = "gbl_session";

async function makeValidToken(): Promise<string> {
  const { signSession } = await import("./session");
  return await signSession({ sub: "admin", role: "ADMIN" });
}

async function importGuard() {
  return await import("./guard");
}

describe("requireAdminSession - 실패 케이스 (redirect throw)", () => {
  it("쿠키가 없으면 redirect('/admin/login') 호출 후 throw", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const { requireAdminSession } = await importGuard();

    await expect(requireAdminSession()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("쿠키 값이 빈 문자열이어도 redirect", async () => {
    cookieGetMock.mockReturnValue({ name: COOKIE_NAME, value: "" });

    const { requireAdminSession } = await importGuard();

    await expect(requireAdminSession()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("쿠키가 변조된 jwt 면 redirect", async () => {
    cookieGetMock.mockReturnValue({
      name: COOKIE_NAME,
      value: "tampered.invalid.token",
    });

    const { requireAdminSession } = await importGuard();

    await expect(requireAdminSession()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");
  });

  it("만료된 jwt 면 redirect", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await makeValidToken();

    // 7일 + 1초 뒤
    vi.setSystemTime(
      new Date("2026-01-01T00:00:00Z").getTime() +
        (60 * 60 * 24 * 7 + 1) * 1000
    );

    cookieGetMock.mockReturnValue({ name: COOKIE_NAME, value: token });

    const { requireAdminSession } = await importGuard();

    await expect(requireAdminSession()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin/login");

    vi.useRealTimers();
  });
});

describe("requireAdminSession - 성공 케이스", () => {
  it("유효 토큰이면 payload(sub, role) 반환, redirect 미호출", async () => {
    const token = await makeValidToken();
    cookieGetMock.mockReturnValue({ name: COOKIE_NAME, value: token });

    const { requireAdminSession } = await importGuard();
    const result = await requireAdminSession();

    expect(result).toEqual({ sub: "admin", role: "ADMIN" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireAdminSession - 쿠키 이름 분기", () => {
  it("production 환경에서는 '__Host-gbl_session' 으로 쿠키를 조회한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    // production 쿠키 이름
    const PROD_COOKIE_NAME = "__Host-gbl_session";

    // 토큰 발급
    const { signSession } = await import("./session");
    const token = await signSession({ sub: "admin", role: "ADMIN" });

    cookieGetMock.mockImplementation((name: string) => {
      if (name === PROD_COOKIE_NAME) {
        return { name, value: token };
      }
      return undefined;
    });

    const { requireAdminSession } = await importGuard();
    const result = await requireAdminSession();

    expect(result).toEqual({ sub: "admin", role: "ADMIN" });
    expect(cookieGetMock).toHaveBeenCalledWith(PROD_COOKIE_NAME);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("getOptionalAdminSession", () => {
  it("쿠키가 없으면 null 을 반환하고 redirect 안 한다", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const { getOptionalAdminSession } = await importGuard();
    const result = await getOptionalAdminSession();

    expect(result).toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("변조된 쿠키도 null (throw 금지)", async () => {
    cookieGetMock.mockReturnValue({
      name: COOKIE_NAME,
      value: "tampered.invalid.token",
    });

    const { getOptionalAdminSession } = await importGuard();
    const result = await getOptionalAdminSession();

    expect(result).toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("유효 쿠키면 payload 반환", async () => {
    const token = await makeValidToken();
    cookieGetMock.mockReturnValue({ name: COOKIE_NAME, value: token });

    const { getOptionalAdminSession } = await importGuard();
    const result = await getOptionalAdminSession();

    expect(result).toEqual({ sub: "admin", role: "ADMIN" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("만료된 쿠키면 null 반환", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await makeValidToken();

    vi.setSystemTime(
      new Date("2026-01-01T00:00:00Z").getTime() +
        (60 * 60 * 24 * 7 + 1) * 1000
    );

    cookieGetMock.mockReturnValue({ name: COOKIE_NAME, value: token });

    const { getOptionalAdminSession } = await importGuard();
    const result = await getOptionalAdminSession();

    expect(result).toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
