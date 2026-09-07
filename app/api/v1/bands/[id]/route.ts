/**
 * 공개 API `GET /api/v1/bands/{id}`.
 *  - GET → 200 단건 (getBandById) / 404 미존재 / 401 인증 실패.
 *
 * Next 15: params 는 Promise.
 */
import { authenticateApiRequest } from "@/lib/api/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api/response";
import { getBandById } from "@/lib/band/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  if (!(await authenticateApiRequest(request))) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return jsonError("not_found", 404);
  const band = await getBandById(id);
  if (!band) return jsonError("not_found", 404);
  return jsonOk(band);
}
