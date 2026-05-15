import type { Metadata } from "next";
import { Suspense } from "react";

import { fetchOg } from "@/lib/og-fetch";
import { OgCard } from "@/components/site/og-card";
import { OgCardSkeleton } from "@/components/site/og-card-skeleton";

export const metadata: Metadata = {
  title: "티켓사이트 가입 | 원정가고싶다",
  description: "일본 라이브 티켓 사이트 회원가입 / 일본 유심·eSIM 바로가기",
};

// 빌드 시 prerender 금지 — SiteHeader 가 DB(Prisma) 를 호출하므로 동적 렌더링.
// 단, 페이지 셸은 즉시 응답하고 외부 OG fetch 는 Suspense 로 스트리밍한다.
// OG 데이터는 fetchOg() 내부 fetch 캐시(86400s)로 캐싱된다.
export const dynamic = "force-dynamic";

type Entry = {
  url: string;
  label?: string;
};

const FEATURED: Entry = {
  url: "https://m.dcinside.com/board/bandress/600899",
  label: "일본 티켓팅 가이드 (밴드리스 갤러리)",
};

const TICKETS: Entry[] = [
  { url: "https://eplus.jp/", label: "e+ (イープラス)" },
  { url: "https://l-tike.com/", label: "ローソンチケット" },
  { url: "https://t.pia.jp/", label: "チケットぴあ" },
  { url: "https://zaiko.io/", label: "ZAIKO" },
  { url: "https://www.emtg.jp/", label: "EMTG" },
  { url: "https://t.livepocket.jp/", label: "livepocket" },
];

const SIMS: Entry[] = [
  { url: "https://www.mobal.com/", label: "Mobal" },
  { url: "https://www.sakuramobile.jp/", label: "Sakura Mobile" },
  { url: "https://www.airalo.com/", label: "Airalo eSIM" },
  { url: "https://www.japan-wireless.com/", label: "Japan Wireless" },
];

async function AsyncOgCard({ entry }: { entry: Entry }) {
  const og = await fetchOg(entry.url);
  return <OgCard og={og} fallbackLabel={entry.label} />;
}

export default function TicketSitesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          티켓사이트 가입!!
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          일본 직관 가기 전에 — 티켓 사이트 회원가입과 유심 바로가기
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          추천 글
        </h2>
        <div className="grid gap-3">
          <Suspense fallback={<OgCardSkeleton />}>
            <AsyncOgCard entry={FEATURED} />
          </Suspense>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          티켓 사이트
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {TICKETS.map((entry) => (
            <Suspense key={entry.url} fallback={<OgCardSkeleton />}>
              <AsyncOgCard entry={entry} />
            </Suspense>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          일본 유심 / eSIM
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SIMS.map((entry) => (
            <Suspense key={entry.url} fallback={<OgCardSkeleton />}>
              <AsyncOgCard entry={entry} />
            </Suspense>
          ))}
        </div>
      </section>
    </main>
  );
}
