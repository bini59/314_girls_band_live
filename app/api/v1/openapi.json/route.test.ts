import { describe, expect, it } from "vitest";

import { GET } from "./route";
import { openApiDocument } from "@/lib/api/openapi";

describe("GET /api/v1/openapi.json", () => {
  it("유효한 JSON OpenAPI 문서를 200 으로 서빙한다", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.components.securitySchemes.apiKey).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
    });
  });

  it("7개 오퍼레이션과 요청/응답 스키마를 모두 포함한다", () => {
    const { paths, components } = openApiDocument;
    const ops = Object.values(paths).flatMap((p) => Object.keys(p));
    // GET/POST lives, GET/PATCH lives/{id}, GET/POST bands, GET bands/{id}
    expect(ops).toHaveLength(7);
    expect(Object.keys(components.schemas).sort()).toEqual([
      "Band",
      "CreateBandInput",
      "CreateLiveInput",
      "Error",
      "Live",
      "UpdateLiveInput",
    ]);
  });

  it("모든 오퍼레이션이 전역 X-API-Key 보안을 상속한다", () => {
    expect(openApiDocument.security).toEqual([{ apiKey: [] }]);
  });
});
