import { NextRequest, NextResponse } from "next/server";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from "@/lib/auth/session";

/**
 * Admin authentication gate.
 *
 * Behaviour:
 *  - Non-/admin paths: pass through (NextResponse.next).
 *  - /admin/login: pass through (the login page itself must be reachable).
 *  - /admin/api/*: pass through (API routes do their own validation).
 *  - Other /admin/*: require a valid session cookie. Otherwise redirect to login.
 *
 * Runtime: Edge — uses jose only. bcryptjs is intentionally NOT imported here.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Only intercept /admin/* routes.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // /admin/login itself must be public.
  if (
    pathname === ADMIN_LOGIN_PATH ||
    pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  ) {
    return NextResponse.next();
  }

  // /admin/api/* — APIs validate authentication on their own.
  if (pathname.startsWith("/admin/api/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  const payload = await verifySession(token);
  if (!payload) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = ADMIN_LOGIN_PATH;
  url.search = "";
  return NextResponse.redirect(url, { status: 307 });
}

export const config = {
  matcher: ["/admin/:path*"],
};
