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
  csrf: string,
  returnTo: string
): Promise<boolean> {
  if (!sid || !csrf || !isRemoteAuthConfigured()) return false;

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
