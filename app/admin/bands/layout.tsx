import type { Metadata } from "next";

import { requireAdminSession } from "@/lib/auth/guard";

import { AdminShell } from "../_components/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "밴드 관리 — 원정가고싶다",
};

export default async function AdminBandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
