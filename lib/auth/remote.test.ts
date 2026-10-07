import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAuthLoginUrl,
  isRemoteAuthConfigured,
  revokeRemoteSession,
  sidCookieDomain,
  verifyRemoteSession,
} from "./remote";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("remote auth configuration", () => {
  it("clears sid on the parent domain auth sets it on", () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    expect(sidCookieDomain()).toBe("bini59.dev");
    vi.stubEnv("AUTH_ORIGIN", "http://localhost:4000");
    expect(sidCookieDomain()).toBeUndefined();
  });

  it("requires all server-side SSO settings", () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "server-only-secret");

    expect(isRemoteAuthConfigured()).toBe(true);
    expect(buildAuthLoginUrl("https://gbl.bini59.dev/admin/lives")).toBe(
      "https://auth.bini59.dev/login?client_id=gbl&return_to=https%3A%2F%2Fgbl.bini59.dev%2Fadmin%2Flives"
    );
  });

  it("rejects partial configuration", () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "");

    expect(isRemoteAuthConfigured()).toBe(false);
  });
});

describe("verifyRemoteSession", () => {
  it("revokes the session with a matched csrf pair even without a browser csrf cookie", async () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "server-only-secret");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 302 }));

    await expect(
      revokeRemoteSession("sid-1", "https://gbl.bini59.dev/admin/login")
    ).resolves.toBe(true);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const csrf = headers["x-csrf-token"];
    expect(init.method).toBe("POST");
    expect(csrf).toBeTruthy();
    expect(headers.cookie).toBe(`sid=sid-1; csrf=${csrf}`);
  });

  it("forwards sid and app secret without exposing the secret to the browser", async () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "server-only-secret");
    vi.stubEnv("AUTH_REQUIRED_ROLE", "admin");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: "user-1",
          email: "admin@example.com",
          name: "Admin",
          membership: { role: "admin", status: "active" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(verifyRemoteSession("sid-value")).resolves.toEqual({
      kind: "authenticated",
      userId: "user-1",
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      avatarUrl: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(String(requestUrl)).toBe(
      "https://auth.bini59.dev/verify?client_id=gbl"
    );
    expect(requestInit.headers).toEqual({
      cookie: "sid=sid-value",
      "x-app-secret": "server-only-secret",
    });
  });

  it("maps missing membership and suspended responses to forbidden", async () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "server-only-secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ userId: "user-1", membership: null }), {
        status: 200,
      })
    );

    await expect(verifyRemoteSession("sid-value")).resolves.toEqual({
      kind: "forbidden",
    });
  });

  it("distinguishes unauthenticated, forbidden, and unavailable auth", async () => {
    vi.stubEnv("AUTH_ORIGIN", "https://auth.bini59.dev");
    vi.stubEnv("CLIENT_ID", "gbl");
    vi.stubEnv("APP_SECRET", "server-only-secret");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(verifyRemoteSession("sid-value")).resolves.toEqual({
      kind: "unauthenticated",
    });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(verifyRemoteSession("sid-value")).resolves.toEqual({
      kind: "forbidden",
    });

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(verifyRemoteSession("sid-value")).resolves.toEqual({
      kind: "unavailable",
    });
  });
});
