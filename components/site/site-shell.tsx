"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, type NavItem } from "@bini59/design";

import type { NavWork } from "@/lib/public/queries";

import { ThemeToggle } from "@/components/theme/theme-toggle";

const HOME: NavItem = { id: "home", label: "라이브 캘린더", href: "/" };
const TICKETS: NavItem = { id: "ticket-sites", label: "티켓사이트 가입", href: "/ticket-sites" };

function buildNav(works: NavWork[]): NavItem[] {
  return [
    HOME,
    ...works.map((work) => ({
      id: `work-${work.slug}`,
      label: work.nameKo,
      href: `/works/${work.slug}`,
      children: work.bands.map((band) => ({
        id: `band-${band.slug}`,
        label: band.nameKo,
        href: `/bands/${band.slug}`,
      })),
    })),
    TICKETS,
  ];
}

/** 현재 경로에 해당하는 nav id + 브레드크럼 조각. 상세 페이지(라이브/투어)는 부모 항목만 강조한다. */
export function resolveActive(pathname: string, works: NavWork[]): { activeId: string; trail: string[] } {
  const band = /^\/bands\/([^/]+)/.exec(pathname);
  if (band) {
    const parent = works.find((w) => w.bands.some((b) => b.slug === band[1]));
    const found = parent?.bands.find((b) => b.slug === band[1]);
    if (found) return { activeId: `band-${found.slug}`, trail: [parent!.nameKo, found.nameKo] };
  }
  const work = /^\/works\/([^/]+)/.exec(pathname);
  if (work) {
    const found = works.find((w) => w.slug === work[1]);
    if (found) return { activeId: `work-${found.slug}`, trail: [found.nameKo] };
  }
  if (pathname.startsWith(TICKETS.href!)) return { activeId: TICKETS.id, trail: [TICKETS.label] };
  if (pathname.startsWith("/lives/")) return { activeId: HOME.id, trail: [HOME.label, "공연 상세"] };
  if (pathname.startsWith("/tours/")) return { activeId: HOME.id, trail: [HOME.label, "투어 상세"] };
  return { activeId: HOME.id, trail: [HOME.label] };
}

/**
 * 공개 사이트 셸 — @bini59/design AppShell (사이드바 + 톱바).
 *
 * 인증이 없으므로 user/onLogout 을 넘기지 않는다 (로그아웃 버튼·아바타 미표시).
 * 880px 미만에서는 AppShell 내장 drawer 가 사이드바를 대체한다.
 * 작품/밴드 트리는 서버에서 미리 가져온 works 로 만든다.
 */
export function SiteShell({ works, children }: { works: NavWork[]; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { activeId, trail } = resolveActive(pathname, works);
  return (
    <div className="site-theme min-h-[100dvh]">
      <AppShell
        brand={{
          mark: <Image src="/logo.png" alt="" aria-hidden width={24} height={24} priority className="size-full object-cover" />,
          name: "원정가고싶다",
          href: "/",
        }}
        nav={buildNav(works)}
        activeId={activeId}
        renderLink={(item, inner) => <Link href={item.href ?? "#"}>{inner}</Link>}
        crumb={trail.map((part, i) =>
          i === trail.length - 1 ? <strong key={part}>{part}</strong> : <span key={part}>{part} /</span>,
        )}
        sidebarFoot={<ThemeToggle className="w-full [&>button]:h-8 [&>button]:flex-1" />}
      >
        {children}
      </AppShell>
    </div>
  );
}
