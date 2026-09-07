/**
 * 공개 API `GET/POST /api/v1/lives` 통합 테스트 (RED — 라우트 미구현).
 *
 * 계약:
 *  - 인증: 모든 요청 `X-API-Key: <plaintext>` 헤더 필수. 없음/오키/폐기키 → 401 `{error:"unauthorized"}`.
 *  - GET  → 200, Live 배열 (listLivesForAdmin 재사용).
 *  - POST → 201, 생성된 Live (createLive 재사용). 필수 필드 누락 → 422 `{error:"validation_error"}`.
 *  - datetime 입출력은 순수 UTC ISO 8601. 응답 startAt 은 입력과 동일 순간을 나타낸다.
 *
 * 라우트 핸들러(`./route` 의 GET/POST)를 직접 import 하여 `new Request` 로 호출하고 Response 를 검증한다.
 * 실 DB 사용 — `@/lib/db` 의 prisma 와 testDb 가 같은 DATABASE_URL 을 공유한다.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createApiKeyRow } from "@/test/factories/api-key";
import { createLive } from "@/test/factories/live";

import { GET, POST } from "./route";

const VALID_KEY = "gbl_v1_lives_key";

function apiRequest(
  init: { method?: string; key?: string; body?: unknown } = {}
): Request {
  const { method = "GET", key, body } = init;
  const headers = new Headers();
  if (key !== undefined) headers.set("X-API-Key", key);
  const reqInit: RequestInit = { method, headers };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    reqInit.body = JSON.stringify(body);
  }
  return new Request("https://example.test/api/v1/lives", reqInit);
}

const VALID_POST_BODY = {
  slug: "api-created-live",
  titleKo: "API 생성 라이브",
  titleJp: "APIライブ",
  type: "SOLO",
  startAt: "2026-07-02T12:00:00Z",
  venueName: "Zepp Tokyo",
};

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("GET /api/v1/lives — 인증", () => {
  it("X-API-Key 헤더 없으면 401 unauthorized", async () => {
    const res = await GET(apiRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("잘못된 키면 401", async () => {
    await createApiKeyRow({ plaintext: VALID_KEY });
    const res = await GET(apiRequest({ key: "gbl_wrong" }));
    expect(res.status).toBe(401);
  });

  it("폐기된 키면 401", async () => {
    await createApiKeyRow({ plaintext: VALID_KEY, revokedAt: new Date() });
    const res = await GET(apiRequest({ key: VALID_KEY }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/lives — 성공", () => {
  beforeEach(async () => {
    await createApiKeyRow({ plaintext: VALID_KEY });
  });

  it("유효 키면 200 + Live 배열", async () => {
    await createLive();
    await createLive();
    const res = await GET(apiRequest({ key: VALID_KEY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("datetime 은 UTC ISO 문자열로 직렬화된다", async () => {
    await createLive({ startAt: new Date("2026-03-15T09:00:00Z") });
    const res = await GET(apiRequest({ key: VALID_KEY }));
    const body = await res.json();
    expect(new Date(body[0].startAt).toISOString()).toBe(
      "2026-03-15T09:00:00.000Z"
    );
  });
});

describe("POST /api/v1/lives", () => {
  beforeEach(async () => {
    await createApiKeyRow({ plaintext: VALID_KEY });
  });

  it("인증 없으면 401", async () => {
    const res = await POST(apiRequest({ method: "POST", body: VALID_POST_BODY }));
    expect(res.status).toBe(401);
  });

  it("유효 payload → 201 + 생성된 Live + DB 반영", async () => {
    const res = await POST(
      apiRequest({ method: "POST", key: VALID_KEY, body: VALID_POST_BODY })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe("api-created-live");

    const row = await testDb.live.findUnique({ where: { id: body.id } });
    expect(row?.titleKo).toBe("API 생성 라이브");
  });

  it("UTC ISO 입력 → 응답이 동일 순간을 나타낸다 (라운드트립)", async () => {
    const res = await POST(
      apiRequest({ method: "POST", key: VALID_KEY, body: VALID_POST_BODY })
    );
    const body = await res.json();
    expect(new Date(body.startAt).toISOString()).toBe(
      new Date("2026-07-02T12:00:00Z").toISOString()
    );
  });

  it("필수 필드(titleKo) 누락 → 422 validation_error", async () => {
    const { titleKo: _omit, ...invalid } = VALID_POST_BODY;
    const res = await POST(
      apiRequest({ method: "POST", key: VALID_KEY, body: invalid })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("validation_error");
  });

  it("잘못된 타입(startAt 이 datetime 아님) → 422", async () => {
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: { ...VALID_POST_BODY, startAt: "not-a-date" },
      })
    );
    expect(res.status).toBe(422);
  });
});
