"use server";

/**
 * `/admin/api-keys` Server Actions — 라이브 등록 공개 API 키 관리.
 *
 * 책임:
 *  - 어드민 세션 강제 (`requireAdminSession`).
 *  - 입력 검증 (Zod: apiKeyIssueSchema — 이름 필수).
 *  - 도메인 repo (`lib/api-key/repo`) 호출 (DB I/O 재구현 금지).
 *  - mutation 성공 시 `/admin/api-keys` 재검증.
 *
 * 평문 키는 발급(issue) 응답으로만 1회 노출되고 DB 엔 해시+prefix 만 저장된다.
 *
 * 응답 형식 (discriminated union):
 *  - 발급 성공: `{ ok: true, apiKey, plaintext }`
 *  - 폐기 성공: `{ ok: true }`
 *  - 실패: `{ ok: false, error?, fieldErrors? }`
 */

import { revalidatePath } from "next/cache";
import type { ApiKey } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/guard";
import { apiKeyIssueSchema } from "@/lib/admin/schemas/api-key";
import { createApiKey, revokeApiKey } from "@/lib/api-key/repo";

// =====================================================================
// 응답 타입
// =====================================================================

export type IssueApiKeyResult =
  | { ok: true; apiKey: ApiKey; plaintext: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

export type RevokeApiKeyResult = { ok: true } | { ok: false; error?: string };

// =====================================================================
// 메시지 상수
// =====================================================================

const INVALID_ID_MESSAGE = "유효하지 않은 API 키 ID 입니다.";
const ISSUE_FAILURE_MESSAGE = "API 키 발급에 실패했습니다.";
const REVOKE_FAILURE_MESSAGE = "API 키 폐기에 실패했습니다.";
const NOT_FOUND_MESSAGE = "이미 폐기되었거나 존재하지 않는 키입니다.";

const API_KEYS_PATH = "/admin/api-keys";

// =====================================================================
// 헬퍼
// =====================================================================

/** id 가 양의 정수인지 검증. */
function isValidId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

/** repo/Prisma 의 not-found (P2025) 판별. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

// =====================================================================
// Server Actions
// =====================================================================

/**
 * API 키 발급.
 *
 * - name 검증 (trim 후 1..100자, 빈/공백 거부).
 * - `createApiKey` 재사용 — 평문은 응답으로만 1회 노출.
 */
export async function issueApiKeyAction(name: string): Promise<IssueApiKeyResult> {
  await requireAdminSession();

  const parsed = apiKeyIssueSchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { apiKey, plaintext } = await createApiKey(parsed.data.name);
    revalidatePath(API_KEYS_PATH);
    return { ok: true, apiKey, plaintext };
  } catch (err) {
    console.error("[issueApiKeyAction]", err);
    return { ok: false, error: ISSUE_FAILURE_MESSAGE };
  }
}

/**
 * API 키 폐기.
 *
 * - `revokeApiKey` 재사용 — revokedAt 을 채워 이후 인증 가드가 거부한다.
 */
export async function revokeApiKeyAction(id: number): Promise<RevokeApiKeyResult> {
  await requireAdminSession();

  if (!isValidId(id)) {
    return { ok: false, error: INVALID_ID_MESSAGE };
  }

  try {
    await revokeApiKey(id);
    revalidatePath(API_KEYS_PATH);
    return { ok: true };
  } catch (err) {
    console.error("[revokeApiKeyAction]", err);
    if (isNotFoundError(err)) {
      return { ok: false, error: NOT_FOUND_MESSAGE };
    }
    return { ok: false, error: REVOKE_FAILURE_MESSAGE };
  }
}
