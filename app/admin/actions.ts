"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
} from "@/lib/auth/session";
import { isRemoteAuthConfigured, revokeRemoteSession } from "@/lib/auth/remote";

/**
 * Server Action: 어드민 로그아웃.
 *
 * - 세션 쿠키를 만료(maxAge:0) 시키고 `/admin/login` 으로 redirect.
 * - 쿠키 옵션은 발급 시(`buildSessionCookieOptions`)와 동일하게 맞춰
 *   브라우저가 동일 쿠키로 인식하고 삭제하도록 보장한다.
 *   (sameSite/secure/path 가 다르면 일부 브라우저가 별개 쿠키로 취급하여
 *    세션이 남는 케이스가 발생한다.)
 * - 세션 유무에 영향받지 않음 (멱등).
 *
 * 호출처: `<form action={signOutAction}>` 의 로그아웃 버튼.
 */
export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();

  if (isRemoteAuthConfigured()) {
    const sid = cookieStore.get("sid")?.value ?? "";
    const csrf = cookieStore.get("csrf")?.value ?? "";
    const returnTo = new URL("/admin/login", process.env.APP_ORIGIN ?? "http://localhost:3000").toString();
    await revokeRemoteSession(sid, csrf, returnTo);
    cookieStore.set("sid", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    redirect("/admin/login");
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...buildSessionCookieOptions(),
    maxAge: 0,
  });
  redirect(ADMIN_LOGIN_PATH);
}
