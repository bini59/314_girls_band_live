import type { Metadata } from "next";

import { fetchOg } from "@/lib/og-fetch";
import { OgCard } from "@/components/site/og-card";

export const metadata: Metadata = {
  title: "티켓사이트 가입 | 걸즈밴드 라이브",
  description: "일본 라이브 티켓 사이트 회원가입 / 일본 유심·eSIM 바로가기",
};

// 1일 단위 ISR — OG 데이터는 거의 안 바뀜
export const revalidate = 60 * 60 * 24;

type Entry = {
  url: string;
  label?: string;
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

async function loadAll(entries: Entry[]) {
  return Promise.all(
    entries.map(async (e) => ({ entry: e, og: await fetchOg(e.url) }))
  );
}

export default async function TicketSitesPage() {
  const [tickets, sims] = await Promise.all([loadAll(TICKETS), loadAll(SIMS)]);

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
          티켓 사이트
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {tickets.map(({ entry, og }) => (
            <OgCard key={entry.url} og={og} fallbackLabel={entry.label} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          일본 유심 / eSIM
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {sims.map(({ entry, og }) => (
            <OgCard key={entry.url} og={og} fallbackLabel={entry.label} />
          ))}
        </div>
      </section>
    </main>
  );
}
