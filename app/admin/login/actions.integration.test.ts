import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";

const TEST_PLAIN_PASSWORD = "correct-horse-battery-staple";
const TEST_JWT_SECRET =
  "test-secret-test-secret-test-secret-test-secret-32bytes-min";

// next/headers, next/navigation 을 mock 한다.
// cookies().set 호출 인자 캡쳐, redirect 호출 인자 캡쳐.
const cookieSetMock = vi.fn();
const cookieGetMock = vi.fn();
const cookieDeleteMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieSetMock,
    get: cookieGetMock,
    delete: cookieDeleteMock,
  }),
}));

const redirectMock = vi.fn((url: string) => {
  // Next.js 의 redirect 는 throw 로 동작 — 흐름 종료 보장
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

let hashedPassword: string;

beforeEach(async () => {
  cookieSetMock.mockReset();
  cookieGetMock.mockReset();
  cookieDeleteMock.mockReset();
  redirectMock.mockClear();

  hashedPassword = await bcrypt.hash(TEST_PLAIN_PASSWORD, 4);

  vi.stubEnv("ADMIN_PASSWORD_HASH", hashedPassword);
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function callSignIn(password: string | null | undefined) {
  // 매 테스트마다 fresh import (env 반영 보장)
  const { signInAction } = await import("./actions");
  const fd = new FormData();
  if (password !== null && password !== undefined) {
    fd.set("password", password);
  }
  return await signInAction(undefined as unknown as never, fd);
}

describe("signInAction - 실패", () => {
  it("빈 password 는 { ok:false, error:'로그인 실패' } 반환, 쿠키 미설정, redirect 미호출", async () => {
    const result = await callSignIn("");

    expect(result).toEqual({ ok: false, error: "로그인 실패" });
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("password 필드 자체가 누락된 경우도 동일하게 처리", async () => {
    const result = await callSignIn(null);

    expect(result).toEqual({ ok: false, error: "로그인 실패" });
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("틀린 비밀번호는 { ok:false, error:'로그인 실패' } 반환, '비밀번호 불일치' 같은 구체적 메시지 금지", async () => {
    const result = await callSignIn("wrong-password");

    expect(result).toEqual({ ok: false, error: "로그인 실패" });
    expect((result as { error: string }).error).not.toMatch(/비밀번호/);
    expect((result as { error: string }).error).not.toMatch(/불일치/);
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // 보안 강화: bcrypt DoS / 입력 비대화 방지.
  // Zod 스키마에 max=256 을 추가하여 bcrypt 비교 이전에 차단되어야 한다.
  it("password 가 257자 이상이면 verifyPassword(bcrypt) 호출 전에 차단되어야 한다", async () => {
    // verifyPassword 를 spy 로 잡아 "호출되지 않음" 을 검증한다.
    const passwordMod = await import("@/lib/auth/password");
    const spy = vi
      .spyOn(passwordMod, "verifyPassword")
      .mockResolvedValue(false);

    const tooLong = "a".repeat(257);
    const result = await callSignIn(tooLong);

    expect(result).toEqual({ ok: false, error: "로그인 실패" });
    // 핵심: schema 단계에서 잘려야 하므로 verifyPassword 는 한 번도 호출되지 않는다.
    expect(spy).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});

describe("signInAction - 성공", () => {
  it("올바른 비밀번호는 gbl_session 쿠키를 설정하고 /admin/lives 로 redirect 한다", async () => {
    // redirect 가 throw 하므로 try/catch
    let thrown: unknown;
    try {
      await callSignIn(TEST_PLAIN_PASSWORD);
    } catch (e) {
      thrown = e;
    }

    // redirect 호출 검증
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/admin/lives");
    expect(thrown).toBeInstanceOf(Error);

    // 쿠키 set 호출 검증
    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    const [setArg1, setArg2, setArg3] = cookieSetMock.mock.calls[0];
    // 두 형태 지원: cookies().set(name, value, options) 또는 cookies().set({ name, value, ...options })
    if (typeof setArg1 === "string") {
      expect(setArg1).toBe("gbl_session");
      expect(typeof setArg2).toBe("string");
      expect((setArg2 as string).length).toBeGreaterThan(0);
      expect(setArg3).toBeDefined();
    } else {
      expect(setArg1.name).toBe("gbl_session");
      expect(typeof setArg1.value).toBe("string");
      expect(setArg1.value.length).toBeGreaterThan(0);
    }
  });

  it("쿠키 옵션: httpOnly=true, sameSite='lax', maxAge=604800, path='/'", async () => {
    try {
      await callSignIn(TEST_PLAIN_PASSWORD);
    } catch {
      // redirect throw 무시
    }

    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    const call = cookieSetMock.mock.calls[0];
    const opts =
      typeof call[0] === "string"
        ? (call[2] as Record<string, unknown>)
        : (call[0] as Record<string, unknown>);

    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(60 * 60 * 24 * 7);
    expect(opts.path).toBe("/");
  });

  it("개발/테스트(NODE_ENV != production)에서는 쿠키 secure=false", async () => {
    vi.stubEnv("NODE_ENV", "test");

    try {
      await callSignIn(TEST_PLAIN_PASSWORD);
    } catch {
      // redirect throw 무시
    }

    const call = cookieSetMock.mock.calls[0];
    const opts =
      typeof call[0] === "string"
        ? (call[2] as Record<string, unknown>)
        : (call[0] as Record<string, unknown>);

    expect(opts.secure).toBe(false);
  });

  it("프로덕션(NODE_ENV='production')에서는 쿠키 secure=true", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      await callSignIn(TEST_PLAIN_PASSWORD);
    } catch {
      // redirect throw 무시
    }

    const call = cookieSetMock.mock.calls[0];
    const opts =
      typeof call[0] === "string"
        ? (call[2] as Record<string, unknown>)
        : (call[0] as Record<string, unknown>);

    expect(opts.secure).toBe(true);
  });

  // 쿠키 값이 실제로 verifySession 으로 복호화되는지 — 라운드트립 검증
  it("발급된 쿠키 값은 verifySession 으로 검증 가능한 유효 JWT 이다", async () => {
    try {
      await callSignIn(TEST_PLAIN_PASSWORD);
    } catch {
      // redirect throw 무시
    }

    const call = cookieSetMock.mock.calls[0];
    const tokenValue =
      typeof call[0] === "string"
        ? (call[1] as string)
        : ((call[0] as { value: string }).value);

    expect(typeof tokenValue).toBe("string");
    expect(tokenValue.split(".")).toHaveLength(3);

    const { verifySession } = await import("@/lib/auth/session");
    const payload = await verifySession(tokenValue);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe("ADMIN");
  });
});
