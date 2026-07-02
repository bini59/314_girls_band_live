/**
 * 공개 API `GET/POST /api/v1/bands` 통합 테스트 (RED — 라우트 미구현).
 *
 * 계약:
 *  - 인증: `X-API-Key` 필수. 없음/오키/폐기키 → 401 `{error:"unauthorized"}`.
 *  - GET  → 200, Band 배열 (listBands 재사용, work include).
 *  - POST → 201, 생성된 Band (createBand 재사용). 필수 필드 누락 → 422.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createApiKeyRow } from "@/test/factories/api-key";
import { createBand, createWork } from "@/test/factories/band";

import { GET, POST } from "./route";

const VALID_KEY = "gbl_v1_bands_key";

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
  return new Request("https://example.test/api/v1/bands", reqInit);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("GET /api/v1/bands — 인증", () => {
  it("헤더 없으면 401 unauthorized", async () => {
    const res = await GET(apiRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("폐기된 키면 401", async () => {
    await createApiKeyRow({ plaintext: VALID_KEY, revokedAt: new Date() });
    const res = await GET(apiRequest({ key: VALID_KEY }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/bands — 성공", () => {
  beforeEach(async () => {
    await createApiKeyRow({ plaintext: VALID_KEY });
  });

  it("유효 키면 200 + Band 배열", async () => {
    await createBand();
    const res = await GET(apiRequest({ key: VALID_KEY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/v1/bands", () => {
  beforeEach(async () => {
    await createApiKeyRow({ plaintext: VALID_KEY });
  });

  it("인증 없으면 401", async () => {
    const res = await POST(
      apiRequest({ method: "POST", body: { slug: "x" } })
    );
    expect(res.status).toBe(401);
  });

  it("유효 payload → 201 + 생성된 Band + DB 반영", async () => {
    const work = await createWork();
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: {
          workId: work.id,
          slug: "api-band",
          nameKo: "API 밴드",
          nameJp: "APIバンド",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe("api-band");

    const row = await testDb.band.findUnique({ where: { id: body.id } });
    expect(row?.nameKo).toBe("API 밴드");
  });

  it("필수 필드(nameKo) 누락 → 422 validation_error", async () => {
    const work = await createWork();
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: { workId: work.id, slug: "api-band", nameJp: "APIバンド" },
      })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("validation_error");
  });

  it("officialUrl 이 javascript: 스킴 → 422 (XSS 차단)", async () => {
    const work = await createWork();
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: {
          workId: work.id,
          slug: "api-band",
          nameKo: "밴드",
          nameJp: "バンド",
          officialUrl: "javascript:alert(1)",
        },
      })
    );
    expect(res.status).toBe(422);
  });

  it("중복 slug → 409 conflict", async () => {
    const work = await createWork();
    await createBand({ workId: work.id, slug: "dup" });
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: { workId: work.id, slug: "dup", nameKo: "밴드", nameJp: "バンド" },
      })
    );
    expect(res.status).toBe(409);
  });

  it("존재하지 않는 workId → 409 conflict", async () => {
    const res = await POST(
      apiRequest({
        method: "POST",
        key: VALID_KEY,
        body: { workId: 999999, slug: "no-work", nameKo: "밴드", nameJp: "バンド" },
      })
    );
    expect(res.status).toBe(409);
  });
});
