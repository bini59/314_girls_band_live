"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { ADMIN_HOME_PATH } from "@/lib/auth/routes";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  signSession,
} from "@/lib/auth/session";

/**
 * Server Action 상태 타입.
 *
 * useActionState 호환: 초기 상태가 undefined, 실패 시 discriminated union.
 * 성공 경로는 redirect 로 흐름이 종료되어 반환값이 클라이언트에 도달하지 않으므로
 * union 에 success variant 를 포함하지 않는다.
 */
export type SignInState =
  | { ok: false; error: "로그인 실패" }
  | undefined;

/**
 * 입력 스키마.
 *
 * max(256):
 *   bcrypt.compare 는 입력 길이에 비례하지 않지만(72바이트 이후 truncate),
 *   극단적으로 큰 입력을 받으면 네트워크/메모리 자원을 낭비할 수 있다.
 *   DoS 표면을 줄이기 위해 256자 상한으로 사전 차단한다.
 */
const inputSchema = z.object({
  password: z.string().min(1).max(256),
});

const GENERIC_FAILURE: { ok: false; error: "로그인 실패" } = {
  ok: false,
  error: "로그인 실패",
};

/**
 * Server Action: 어드민 로그인.
 *
 * 모든 실패 경로는 동일한 메시지("로그인 실패")로 통일한다 (정보 노출 방지).
 * 성공 시 세션 쿠키를 설정하고 어드민 홈으로 redirect.
 */
export async function signInAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const raw = formData.get("password");
  const parsed = inputSchema.safeParse({
    password: typeof raw === "string" ? raw : "",
  });

  if (!parsed.success) {
    return GENERIC_FAILURE;
  }

  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminHash) {
    // 환경변수가 비어 있어도 사용자에게는 동일 메시지로 응답.
    return GENERIC_FAILURE;
  }

  const ok = await verifyPassword(parsed.data.password, adminHash);
  if (!ok) {
    return GENERIC_FAILURE;
  }

  // 성공: JWT 발급 → 쿠키 set → redirect.
  const token = await signSession({ sub: "admin", role: "ADMIN" });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions());

  // NOTE: redirect() 는 Next.js 내부적으로 NEXT_REDIRECT 에러를 throw 하여
  // Server Action 흐름을 종료시킨다. 절대 try/catch 로 감싸지 말 것 —
  // catch 하면 redirect 가 무력화되어 정상 흐름이 깨진다.
  redirect(ADMIN_HOME_PATH);
}
