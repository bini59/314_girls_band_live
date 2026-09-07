/**
 * 공개 API `GET/POST /api/v1/lives`.
 *  - GET  → 200, Live 배열 (listLivesForAdmin).
 *  - POST → 201, 생성된 Live (createLive). 검증 실패 → 422.
 *  - 인증 실패 → 401.
 */
import { authenticateApiRequest } from "@/lib/api/auth";
import { jsonOk, unauthorized, validationError } from "@/lib/api/response";
import { createLiveSchema } from "@/lib/api/schemas";
import { createLive, listLivesForAdmin } from "@/lib/live/repo";

export async function GET(request: Request): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  return jsonOk(await listLivesForAdmin());
}

export async function POST(request: Request): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  const parsed = createLiveSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) return validationError(parsed.error);
  return jsonOk(await createLive(parsed.data), 201);
}
