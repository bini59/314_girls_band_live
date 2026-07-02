/**
 * 공개 API `GET/POST /api/v1/bands`.
 *  - GET  → 200, Band 배열 (listBands, work include).
 *  - POST → 201, 생성된 Band (createBand). 검증 실패 → 422.
 *  - 인증 실패 → 401.
 */
import { authenticateApiRequest } from "@/lib/api/auth";
import { conflict, jsonOk, unauthorized, validationError } from "@/lib/api/response";
import { createBandSchema } from "@/lib/api/schemas";
import { createBand, listBands } from "@/lib/band/repo";
import { ConflictError } from "@/lib/errors";

export async function GET(request: Request): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  return jsonOk(await listBands());
}

export async function POST(request: Request): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  const parsed = createBandSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) return validationError(parsed.error);
  try {
    return jsonOk(await createBand(parsed.data), 201);
  } catch (err) {
    // 중복 slug / 존재하지 않는 workId → 409.
    if (err instanceof ConflictError) return conflict(err.message);
    throw err;
  }
}
