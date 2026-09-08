"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, type AuthenticatedUser, type NavItem } from "@bini59/design";

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
 * 인증 가드는 호출 레이아웃(`app/admin/lives/layout.tsx`)이 담당하며,
 * 거기서 받은 user 를 그대로 넘겨 Topbar 프로필 팝업을 띄운다 (SSO 일 때만 non-null).
 * nav aria-current 는 AppShell 이 activeId 기준으로 주입한다.
 * 로그아웃은 기존 Server Action(`signOutAction`)을 그대로 호출.
 */
export function AdminShell({
  user = null,
  children,
}: {
  user?: AuthenticatedUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active = NAV.find((n) => pathname.startsWith(n.href!));
  return (
    <div className="admin-theme min-h-[100dvh]">
      <AppShell
        brand={{ mark: "원", name: "원정가고싶다", host: "관리자" }}
        nav={NAV}
        activeId={active?.id ?? ""}
        renderLink={(item, inner) => <Link href={item.href ?? "#"}>{inner}</Link>}
        user={user}
        onLogout={() => void signOutAction()}
        crumb={
          <>
            <span>관리자</span>
            <span>/</span>
            <strong>{active?.label ?? ""}</strong>
          </>
        }
        sidebarFoot={
          // 사이드바 폭을 꽉 채워 3개 옵션 타겟을 키운다 (기본은 size-6 아이콘 버튼).
          <ThemeToggle className="w-full [&>button]:h-8 [&>button]:flex-1" />
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
