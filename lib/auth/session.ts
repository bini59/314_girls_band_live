import { SignJWT, jwtVerify } from "jose";

/**
 * 세션 쿠키 이름.
 *
 * 보안 강화 (OWASP cookie prefix):
 *  - production 환경에서는 `__Host-` prefix 를 적용하여 브라우저가
 *    Secure / Path=/ / Domain 미지정을 강제하도록 한다.
 *  - dev / test 환경(HTTP localhost)에서는 `__Host-` prefix 가 Secure 강제로
 *    오히려 쿠키가 set 되지 않으므로 plain 이름을 사용한다.
 *
 * 모듈 로드 시점에 `NODE_ENV` 를 한 번 평가한다. 테스트는 `vi.resetModules()`
 * 로 재평가한다.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-gbl_session"
    : "gbl_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** JWT issuer — 다른 시스템에서 발급된 토큰 혼용 방지. */
const JWT_ISSUER = "girls-band-live";
/** JWT audience — 본 토큰의 용도(어드민) 명시. */
const JWT_AUDIENCE = "admin";

/**
 * 세션 role.
 *
 * 단일 어드민 사용자만 존재하는 시스템이므로 현재는 "ADMIN" 한 가지.
 * literal union 으로 좁혀 두면 분기 누락이나 misuse 를 컴파일러가 잡아준다.
 */
export type SessionRole = "ADMIN";

export type SessionPayload = {
  sub: string;
  role: SessionRole;
};

const ALG = "HS256";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET 환경변수가 설정되지 않았거나 32바이트 미만입니다."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a session JWT.
 * - Algorithm: HS256
 * - Expiration: SESSION_MAX_AGE_SECONDS (7 days)
 * - issuer / audience claim 포함
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const key = getSecretKey();
  const nowSec = Math.floor(Date.now() / 1000);

  return await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + SESSION_MAX_AGE_SECONDS)
    .sign(key);
}

/**
 * Verify a session JWT.
 * Returns null on any failure (tampered, expired, wrong secret, malformed,
 * issuer/audience 불일치, 알 수 없는 role 등).
 * Never throws.
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  let key: Uint8Array;
  try {
    key = getSecretKey();
  } catch {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const role = payload.role === "ADMIN" ? "ADMIN" : null;

    if (!sub || !role) {
      return null;
    }

    return { sub, role };
  } catch {
    // 변조/만료/iss·aud 불일치 등 jose 가 발생시키는 모든 검증 예외.
    // 운영 환경에서 노이즈를 줄이기 위해 의도적으로 로깅하지 않는다.
    return null;
  }
}

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  maxAge: number;
  path: "/";
  secure: boolean;
};

/**
 * Build cookie options for the session cookie.
 * secure flag depends on NODE_ENV (true only in production).
 */
export function buildSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}
