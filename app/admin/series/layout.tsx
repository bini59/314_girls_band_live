import type { Metadata } from "next";

import { requireAdminSession } from "@/lib/auth/guard";

import { AdminShell } from "../_components/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "시리즈 관리 — 걸즈밴드 라이브",
};

export default async function AdminSeriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
