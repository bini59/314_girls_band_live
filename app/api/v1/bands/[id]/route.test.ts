/**
 * 공개 API `GET /api/v1/bands/{id}` 통합 테스트 (RED — 라우트 미구현).
 *
 * 계약:
 *  - 인증: `X-API-Key` 필수. 없음 → 401.
 *  - GET → 200, 단건 Band (getBandById). 미존재 id → 404.
 *
 * Next 15 App Router 규약: 2번째 인자 `{ params: Promise<{ id: string }> }`.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, disconnectDb } from "@/test/helpers/db";
import { createApiKeyRow } from "@/test/factories/api-key";
import { createBand } from "@/test/factories/band";

import { GET } from "./route";

const VALID_KEY = "gbl_v1_band_id_key";

function apiRequest(key?: string): Request {
  const headers = new Headers();
  if (key !== undefined) headers.set("X-API-Key", key);
  return new Request("https://example.test/api/v1/bands/1", { headers });
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

describe("GET /api/v1/bands/{id}", () => {
  it("인증 없으면 401", async () => {
    const band = await createBand();
    const res = await GET(apiRequest(), ctx(band.id));
    expect(res.status).toBe(401);
  });

  it("존재하는 id → 200 + 단건", async () => {
    const band = await createBand();
    const res = await GET(apiRequest(VALID_KEY), ctx(band.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(band.id);
  });

  it("미존재 id → 404", async () => {
    const res = await GET(apiRequest(VALID_KEY), ctx(999999));
    expect(res.status).toBe(404);
  });
});
