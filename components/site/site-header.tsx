import Image from "next/image";
import Link from "next/link";

import { getWorksForNav } from "@/lib/public/queries";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { MobileMenu } from "./mobile-menu";
import { WorksNav } from "./works-nav";

/**
 * 공개 사이트 헤더.
 * Server Component — Works(+하위 Bands) 미리 가져와 SSR.
 */
export async function SiteHeader() {
  const works = await getWorksForNav();

  return (
    <header className="sticky top-0 z-40 bg-[color:var(--color-page)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-bold tracking-tight"
        >
          <Image
            src="/logo.png"
            alt=""
            aria-hidden
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-full object-cover"
          />
          <span>원정가고싶다</span>
        </Link>

        <div className="hidden flex-1 md:flex md:items-center md:justify-start">
          <WorksNav works={works} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/ticket-sites"
            className="inline-flex h-9 items-center rounded-full bg-[color:var(--color-primary)] px-3 text-xs font-bold tracking-[var(--tracking-button)] text-[color:var(--color-primary-foreground)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] sm:px-4 sm:text-sm"
          >
            티켓사이트 가입!!
          </Link>
          <ThemeToggle />
          <MobileMenu works={works} />
        </div>
      </div>
    </header>
  );
}
