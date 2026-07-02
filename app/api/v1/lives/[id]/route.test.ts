/**
 * 공개 API `GET/PATCH /api/v1/lives/{id}` 통합 테스트 (RED — 라우트 미구현).
 *
 * 계약:
 *  - 인증: `X-API-Key` 필수. 없음/오키 → 401.
 *  - GET   → 200, 단건 Live. 미존재 id → 404.
 *  - PATCH → 200, 부분 수정 (updateLive 재사용). 미존재 id → 404.
 *
 * Next 15 App Router 규약: `[id]` 핸들러 2번째 인자는 `{ params: Promise<{ id: string }> }`.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createApiKeyRow } from "@/test/factories/api-key";
import { createLive } from "@/test/factories/live";

import { GET, PATCH } from "./route";

const VALID_KEY = "gbl_v1_live_id_key";

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
  return new Request("https://example.test/api/v1/lives/1", reqInit);
}

function ctx(id: number | string) {
  return { params: Promise.resolve({ id: String(id) }) };
}

beforeEach(async () => {
  await resetDb();
  await createApiKeyRow({ plaintext: VALID_KEY });
});

afterAll(async () => {
  await disconnectDb();
});

describe("GET /api/v1/lives/{id}", () => {
  it("인증 없으면 401", async () => {
    const live = await createLive();
    const res = await GET(apiRequest(), ctx(live.id));
    expect(res.status).toBe(401);
  });

  it("존재하는 id → 200 + 단건", async () => {
    const live = await createLive();
    const res = await GET(apiRequest({ key: VALID_KEY }), ctx(live.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(live.id);
  });

  it("미존재 id → 404", async () => {
    const res = await GET(apiRequest({ key: VALID_KEY }), ctx(999999));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/lives/{id}", () => {
  it("인증 없으면 401", async () => {
    const live = await createLive();
    const res = await PATCH(
      apiRequest({ method: "PATCH", body: { titleKo: "x" } }),
      ctx(live.id)
    );
    expect(res.status).toBe(401);
  });

  it("부분 수정 → 200 + 변경 반영 (DB)", async () => {
    const live = await createLive();
    const res = await PATCH(
      apiRequest({
        method: "PATCH",
        key: VALID_KEY,
        body: { titleKo: "수정됨" },
      }),
      ctx(live.id)
    );
    expect(res.status).toBe(200);
    expect((await res.json()).titleKo).toBe("수정됨");

    const row = await testDb.live.findUnique({ where: { id: live.id } });
    expect(row?.titleKo).toBe("수정됨");
  });

  it("미존재 id → 404", async () => {
    const res = await PATCH(
      apiRequest({ method: "PATCH", key: VALID_KEY, body: { titleKo: "x" } }),
      ctx(999999)
    );
    expect(res.status).toBe(404);
  });

  it("다른 라이브의 slug 로 수정 → 409 conflict", async () => {
    const a = await createLive();
    const b = await createLive();
    const res = await PATCH(
      apiRequest({ method: "PATCH", key: VALID_KEY, body: { slug: a.slug } }),
      ctx(b.id)
    );
    expect(res.status).toBe(409);
  });

  it("venueUrl 이 javascript: 스킴 → 422 (XSS 차단)", async () => {
    const live = await createLive();
    const res = await PATCH(
      apiRequest({
        method: "PATCH",
        key: VALID_KEY,
        body: { venueUrl: "javascript:alert(1)" },
      }),
      ctx(live.id)
    );
    expect(res.status).toBe(422);
  });
});
