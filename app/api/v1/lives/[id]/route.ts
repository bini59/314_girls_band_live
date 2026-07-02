/**
 * 공개 API `GET/PATCH /api/v1/lives/{id}`.
 *  - GET   → 200 단건 / 404 미존재.
 *  - PATCH → 200 수정 (updateLive) / 404 미존재 / 422 검증 실패.
 *  - 인증 실패 → 401.
 *
 * Next 15: params 는 Promise.
 */
import { authenticateApiRequest } from "@/lib/api/auth";
import { conflict, jsonError, jsonOk, unauthorized, validationError } from "@/lib/api/response";
import { updateLiveSchema } from "@/lib/api/schemas";
import { getLiveById, updateLive } from "@/lib/live/repo";
import { isPrismaUniqueViolation } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  const id = parseId((await params).id);
  if (id === null) return jsonError("not_found", 404);
  const live = await getLiveById(id);
  if (!live) return jsonError("not_found", 404);
  return jsonOk(live);
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  const parsed = updateLiveSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) return validationError(parsed.error);
  const id = parseId((await params).id);
  if (id === null) return jsonError("not_found", 404);
  try {
    return jsonOk(await updateLive(id, parsed.data));
  } catch (err) {
    // updateLive 는 미존재 시 throw. 실제 미존재면 404.
    if (!(await getLiveById(id))) return jsonError("not_found", 404);
    // slug 중복(P2002)은 클라이언트 오류 → 409.
    if (isPrismaUniqueViolation(err)) return conflict("이미 사용 중인 slug 입니다.");
    throw err;
  }
}
