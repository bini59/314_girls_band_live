/**
 * 공개 OpenAPI 스펙 서빙 `GET /api/v1/openapi.json`.
 *  - 인증 불필요 (공개 스펙).
 *  - 정적 객체라 캐시 가능.
 */
import { openApiDocument } from "@/lib/api/openapi";

// ponytail: 정적 문서라 빌드 타임에 굳혀도 됨.
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(openApiDocument, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
