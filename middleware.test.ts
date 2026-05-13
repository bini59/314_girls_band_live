import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";

const TEST_JWT_SECRET =
  "test-secret-test-secret-test-secret-test-secret-32bytes-min";

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function callMiddleware(req: NextRequest) {
  // fresh import 보장
  const mod = await import("./middleware");
  return await mod.middleware(req);
}

function makeRequest(
  pathname: string,
  options: { sessionCookie?: string } = {}
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  if (options.sessionCookie !== undefined) {
    headers.set("cookie", `gbl_session=${options.sessionCookie}`);
  }
  return new NextRequest(url, { headers });
}

async function makeValidToken(): Promise<string> {
  const { signSession } = await import("@/lib/auth/session");
  return await signSession({ sub: "admin", role: "ADMIN" });
}

describe("middleware - /admin/lives 가드", () => {
  it("쿠키가 전혀 없으면 /admin/login 으로 리다이렉트", async () => {
    const req = makeRequest("/admin/lives");
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    // NextResponse.redirect 는 status 307/308 + location 헤더
    expect([307, 308]).toContain(res!.status);
    const location = res!.headers.get("location");
    expect(location).toBeTruthy();
    expect(location!).toContain("/admin/login");
  });

  it("변조된 쿠키는 /admin/login 으로 리다이렉트", async () => {
    const req = makeRequest("/admin/lives", {
      sessionCookie: "tampered.invalid.token",
    });
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    expect([307, 308]).toContain(res!.status);
    expect(res!.headers.get("location")).toContain("/admin/login");
  });

  it("유효한 쿠키는 통과 (리다이렉트 없음, NextResponse.next)", async () => {
    const token = await makeValidToken();
    const req = makeRequest("/admin/lives", { sessionCookie: token });
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    // next() 는 status 200 + 별도 location 헤더 없음.
    expect(res!.headers.get("location")).toBeNull();
    expect(res!.status).toBe(200);
  });
});

describe("middleware - /admin/login 자체는 인증 없이 통과", () => {
  it("쿠키 없어도 /admin/login 은 통과", async () => {
    const req = makeRequest("/admin/login");
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    expect(res!.headers.get("location")).toBeNull();
    expect(res!.status).toBe(200);
  });
});

describe("middleware - /admin/api/* 는 가로채지 않음", () => {
  it("/admin/api/anything 은 쿠키 없어도 통과 (API 자체 검증 위임)", async () => {
    const req = makeRequest("/admin/api/foo");
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    expect(res!.headers.get("location")).toBeNull();
    expect(res!.status).toBe(200);
  });
});

describe("middleware - 비-/admin 경로는 무시", () => {
  it("/ 경로는 쿠키 유무와 무관하게 통과", async () => {
    const req = makeRequest("/");
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    expect(res!.headers.get("location")).toBeNull();
    expect(res!.status).toBe(200);
  });

  it("/live/something 같은 공개 경로도 통과", async () => {
    const req = makeRequest("/live/sample-slug");
    const res = await callMiddleware(req);

    expect(res).toBeDefined();
    expect(res!.headers.get("location")).toBeNull();
    expect(res!.status).toBe(200);
  });
});
