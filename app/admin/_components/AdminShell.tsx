"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, type NavItem } from "@bini59/design";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { signOutAction } from "../actions";

const NAV: NavItem[] = [
  { id: "lives", label: "라이브", href: "/admin/lives" },
  { id: "series", label: "시리즈", href: "/admin/series" },
  { id: "works", label: "작품", href: "/admin/works" },
  { id: "tours", label: "투어", href: "/admin/tours" },
  { id: "bands", label: "밴드", href: "/admin/bands" },
  { id: "vendors", label: "판매처", href: "/admin/vendors" },
  { id: "api-keys", label: "API 키", href: "/admin/api-keys" },
];

/**
 * AdminShell — @bini59/design AppShell 래핑 (Sidebar + Topbar + 본문).
 *
 * 인증 가드는 호출 레이아웃(`app/admin/lives/layout.tsx`)이 담당.
 * 로그아웃은 기존 Server Action(`signOutAction`)을 그대로 호출.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const active = NAV.find((n) => pathname.startsWith(n.href!));
  return (
    <div className="admin-theme min-h-[100dvh]">
      <AppShell
        brand={{ mark: "원", name: "원정가고싶다", host: "관리자" }}
        nav={NAV}
        activeId={active?.id ?? ""}
        renderLink={(item, inner) => (
          <Link href={item.href ?? "#"} aria-current={item.id === active?.id ? "page" : undefined}>
            {inner}
          </Link>
        )}
        user={null}
        onLogout={() => void signOutAction()}
        crumb={
          <>
            <span>관리자</span>
            <span>/</span>
            <strong>{active?.label ?? ""}</strong>
          </>
        }
        sidebarFoot={<ThemeToggle className="justify-self-start" />}
      >
        {children}
      </AppShell>
    </div>
  );
}
