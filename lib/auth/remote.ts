const SID_COOKIE_NAME = "sid";
const DEFAULT_REQUIRED_ROLE = "admin";
const VERIFY_TIMEOUT_MS = 5_000;

export type RemoteAuthResult =
  | {
      kind: "authenticated";
      userId: string;
      role: string;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
    }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

function setting(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function authOrigin(): string {
  return setting("AUTH_ORIGIN").replace(/\/$/, "");
}

export function isRemoteAuthConfigured(): boolean {
  return Boolean(authOrigin() && setting("CLIENT_ID") && setting("APP_SECRET"));
}

export function hasPartialRemoteAuthConfiguration(): boolean {
  const values = [authOrigin(), setting("CLIENT_ID"), setting("APP_SECRET")];
  return values.some(Boolean) && !values.every(Boolean);
}

export function requiredRemoteRole(): string {
  return setting("AUTH_REQUIRED_ROLE") || DEFAULT_REQUIRED_ROLE;
}

export function buildAuthLoginUrl(returnTo: string): string {
  const url = new URL(`${authOrigin()}/login`);
  url.searchParams.set("client_id", setting("CLIENT_ID"));
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

export function buildAuthLogoutUrl(returnTo: string): string {
  const url = new URL(`${authOrigin()}/logout`);
  url.searchParams.set("client_id", setting("CLIENT_ID"));
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

/**
 * 321_auth 는 sid 를 상위 도메인(COOKIE_DOMAIN=.bini59.dev)에 심는다. 앱에서 지울 때도
 * 같은 Domain 을 줘야 브라우저가 같은 쿠키로 보고 삭제한다. localhost 처럼 점이 없으면 host-only.
 */
export function sidCookieDomain(): string | undefined {
  const origin = authOrigin();
  if (!origin) return undefined;
  const parent = new URL(origin).hostname.split(".").slice(1).join(".");
  return parent.includes(".") ? parent : undefined;
}

export async function verifyRemoteSession(
  sid: string
): Promise<RemoteAuthResult> {
  if (!sid || !isRemoteAuthConfigured()) {
    return { kind: "unauthenticated" };
  }

  const url = new URL(`${authOrigin()}/verify`);
  url.searchParams.set("client_id", setting("CLIENT_ID"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        cookie: `${SID_COOKIE_NAME}=${sid}`,
        "x-app-secret": setting("APP_SECRET"),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 403) return { kind: "forbidden" };
    if (!response.ok) return { kind: "unavailable" };

    const body = (await response.json()) as {
      userId?: unknown;
      email?: unknown;
      name?: unknown;
      avatarUrl?: unknown;
      membership?: { role?: unknown; status?: unknown } | null;
    };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = typeof body.membership?.role === "string" ? body.membership.role : "";
    const status = body.membership?.status;

    if (!userId || status !== "active" || role !== requiredRemoteRole()) {
      return { kind: "forbidden" };
    }

    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    return {
      kind: "authenticated",
      userId,
      role,
      email: str(body.email),
      name: str(body.name),
      avatarUrl: str(body.avatarUrl),
    };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function revokeRemoteSession(
  sid: string,
  returnTo: string
): Promise<boolean> {
  if (!sid || !isRemoteAuthConfigured()) return false;

  // auth 의 /logout 은 double-submit CSRF 인데, auth 가 로그인 콜백에서 csrf 쿠키를 지우므로
  // 브라우저 쿠키에 기대면 폐기가 조용히 건너뛰어진다. 서버 간 호출이라 짝을 직접 만든다.
  const csrf = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(buildAuthLogoutUrl(returnTo), {
      method: "POST",
      headers: {
        cookie: `sid=${sid}; csrf=${csrf}`,
        "x-csrf-token": csrf,
      },
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status >= 300 && response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
