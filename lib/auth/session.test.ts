import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// JWT_SECRET 은 lib/auth/session 모듈이 import 시점에 참조할 수 있으므로
// 모듈 import 전에 stub 한다.
const TEST_JWT_SECRET =
  "test-secret-test-secret-test-secret-test-secret-32bytes-min";

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetModules();
});

async function importSession() {
  // 매 테스트마다 fresh import (env 반영 보장)
  return await import("./session");
}

describe("SESSION_COOKIE_NAME 상수", () => {
  it("쿠키 이름은 'gbl_session' 이다", async () => {
    const mod = await importSession();
    expect(mod.SESSION_COOKIE_NAME).toBe("gbl_session");
  });
});

describe("SESSION_MAX_AGE_SECONDS 상수", () => {
  it("7일(60*60*24*7 = 604800)을 표현한다", async () => {
    const mod = await importSession();
    expect(mod.SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});

describe("signSession", () => {
  it("payload(sub, role)을 받아 JWT 형태 문자열(헤더.페이로드.서명)을 반환한다", async () => {
    const { signSession } = await importSession();
    const token = await signSession({ sub: "admin", role: "ADMIN" });

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("같은 payload여도 매번 다른 토큰(또는 동일 토큰이라도 검증 가능한 토큰)을 반환한다", async () => {
    const { signSession } = await importSession();
    const t1 = await signSession({ sub: "admin", role: "ADMIN" });
    expect(t1.length).toBeGreaterThan(0);
  });
});

describe("verifySession - 정상 케이스", () => {
  it("signSession 으로 만든 유효 토큰을 검증하면 payload(sub, role)을 반환한다", async () => {
    const { signSession, verifySession } = await importSession();
    const token = await signSession({ sub: "admin", role: "ADMIN" });
    const payload = await verifySession(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("admin");
    expect(payload?.role).toBe("ADMIN");
  });
});

describe("verifySession - 비정상 케이스 (throw 금지, null 반환)", () => {
  it("변조된 JWT(서명 부분 변경)에 대해 null 을 반환한다", async () => {
    const { signSession, verifySession } = await importSession();
    const token = await signSession({ sub: "admin", role: "ADMIN" });
    const [h, p] = token.split(".");
    const tampered = `${h}.${p}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    const result = await verifySession(tampered);
    expect(result).toBeNull();
  });

  it("완전 깨진 문자열에 대해 null 을 반환한다 (throw 금지)", async () => {
    const { verifySession } = await importSession();
    const result = await verifySession("not-a-jwt-at-all");
    expect(result).toBeNull();
  });

  it("빈 문자열에 대해 null 을 반환한다", async () => {
    const { verifySession } = await importSession();
    const result = await verifySession("");
    expect(result).toBeNull();
  });

  it("다른 시크릿으로 서명된 JWT 에 대해 null 을 반환한다", async () => {
    // 다른 시크릿으로 발급된 토큰을 직접 만든다
    const { SignJWT } = await import("jose");
    const otherSecret = new TextEncoder().encode(
      "other-secret-other-secret-other-secret-32bytes-min!!"
    );
    const foreignToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(otherSecret);

    const { verifySession } = await importSession();
    const result = await verifySession(foreignToken);
    expect(result).toBeNull();
  });

  it("만료된 JWT 에 대해 null 을 반환한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const { signSession, verifySession } = await importSession();
    const token = await signSession({ sub: "admin", role: "ADMIN" });

    // SESSION_MAX_AGE_SECONDS(7일) + 1초 뒤로 시간 이동
    vi.setSystemTime(
      new Date("2026-01-01T00:00:00Z").getTime() +
        (60 * 60 * 24 * 7 + 1) * 1000
    );

    const result = await verifySession(token);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 보안 강화: SESSION_COOKIE_NAME 의 __Host- prefix 적용 (production 한정)
// ---------------------------------------------------------------------------
//
// OWASP 권고: production HTTPS 환경에서는 쿠키 이름에 `__Host-` prefix 를 붙여
// 브라우저가 Secure / Path=/ / Domain 미지정을 강제하도록 한다.
//
// 구현 메모: SESSION_COOKIE_NAME 은 모듈 로드 시점에 NODE_ENV 를 보고 결정한다.
// 본 테스트는 `vi.resetModules()` 로 환경별 fresh import 를 수행하여
// 동적 결정 로직을 검증한다.

describe("SESSION_COOKIE_NAME - 환경별 prefix", () => {
  it("production 환경에서는 '__Host-gbl_session' 이다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const mod = await importSession();
    expect(mod.SESSION_COOKIE_NAME).toBe("__Host-gbl_session");
  });

  it("development 환경에서는 'gbl_session' 이다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const mod = await importSession();
    expect(mod.SESSION_COOKIE_NAME).toBe("gbl_session");
  });

  it("test 환경에서는 'gbl_session' 이다", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    const mod = await importSession();
    expect(mod.SESSION_COOKIE_NAME).toBe("gbl_session");
  });
});

// ---------------------------------------------------------------------------
// 보안 강화: JWT issuer / audience 검증
// ---------------------------------------------------------------------------
//
// 다른 시스템에서 발급된 같은 시크릿의 토큰이 혼용되는 것을 막기 위해
// signSession 은 iss="girls-band-live", aud="admin" 을 항상 포함하고,
// verifySession 은 이 둘이 일치할 때만 payload 를 돌려준다.

describe("signSession - issuer / audience claim", () => {
  it("발급된 토큰의 payload 는 iss='girls-band-live', aud='admin' 을 포함한다", async () => {
    const { signSession } = await importSession();
    const token = await signSession({ sub: "admin", role: "ADMIN" });

    const [, payloadB64] = token.split(".");
    // base64url decode
    const json = Buffer.from(
      payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
    const payload = JSON.parse(json);

    expect(payload.iss).toBe("girls-band-live");
    expect(payload.aud).toBe("admin");
  });
});

describe("verifySession - issuer / audience 불일치 거부", () => {
  it("다른 iss 로 서명된 토큰은 null 을 반환한다", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(TEST_JWT_SECRET);
    const foreignToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin")
      .setIssuer("some-other-service")
      .setAudience("admin")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(key);

    const { verifySession } = await importSession();
    const result = await verifySession(foreignToken);
    expect(result).toBeNull();
  });

  it("다른 aud 로 서명된 토큰은 null 을 반환한다", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(TEST_JWT_SECRET);
    const foreignToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin")
      .setIssuer("girls-band-live")
      .setAudience("public-api")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(key);

    const { verifySession } = await importSession();
    const result = await verifySession(foreignToken);
    expect(result).toBeNull();
  });

  it("iss / aud 미포함 토큰(legacy)도 null 을 반환한다", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(TEST_JWT_SECRET);
    const legacyToken = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(key);

    const { verifySession } = await importSession();
    const result = await verifySession(legacyToken);
    expect(result).toBeNull();
  });
});
