import type { Metadata } from "next";

import { requireAdminSession } from "@/lib/auth/guard";

import { AdminShell } from "../_components/AdminShell";

/**
 * `/admin/api-keys/*` 의 공통 레이아웃.
 *
 * - 첫 줄에서 `requireAdminSession()` — 세션 없으면 `/admin/login` 으로 redirect.
 * - AdminShell (Sidebar + TopBar) 로 래핑.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API 키 관리 — 걸즈밴드 라이브",
};

export default async function AdminApiKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
