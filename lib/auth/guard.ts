import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_LOGIN_PATH } from "./routes";
import {
  SESSION_COOKIE_NAME,
  verifySession,
  type SessionPayload,
} from "./session";

/**
 * 어드민 세션을 강제로 검증한다.
 *
 * - 쿠키가 없거나 변조/만료 등 검증 실패 시 `/admin/login` 으로 redirect 한다.
 *   `next/navigation` 의 `redirect()` 는 내부적으로 NEXT_REDIRECT 에러를
 *   throw 하므로, 이 함수의 정상 반환은 곧 "검증 성공" 을 의미한다.
 * - 성공 시 `{ sub, role: "ADMIN" }` 페이로드를 반환한다.
 *
 * 모든 어드민 Server Action / Server Component 의 첫 줄에서 호출한다.
 */
export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) {
    redirect(ADMIN_LOGIN_PATH);
  }
  return session;
}

/**
 * 어드민 세션이 있으면 페이로드, 없거나 무효하면 `null` 을 반환한다.
 *
 * - 공개 페이지에서 "어드민 세션이 있으면 DRAFT 도 노출" 같은
 *   소프트 분기 (UX_DECISIONS C1) 에 사용한다.
 * - 절대 redirect / throw 하지 않는다.
 */
export async function getOptionalAdminSession(): Promise<SessionPayload | null> {
  return await readSession();
}

/**
 * 내부 헬퍼: 쿠키에서 세션 토큰을 읽어 verify 한 결과를 반환한다.
 * 실패 시 (쿠키 없음 / 빈 값 / verify 실패) 일관되게 `null`.
 */
async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  const token = cookie?.value;
  if (!token) {
    return null;
  }
  return await verifySession(token);
}
