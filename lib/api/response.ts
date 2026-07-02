/**
 * 공개 API 공유 응답 헬퍼 (Group 1 라우트에서 사용).
 */
import type { ZodError } from "zod";

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function unauthorized(): Response {
  return jsonError("unauthorized", 401);
}

export function conflict(message = "conflict"): Response {
  return jsonError(message, 409);
}

export function validationError(zodError: ZodError): Response {
  return Response.json(
    {
      error: "validation_error",
      issues: zodError.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 422 }
  );
}
