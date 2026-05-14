import Link from "next/link";
import { notFound } from "next/navigation";

import { getBandBySlug, getLivesByBandSlug } from "@/lib/public/queries";

import { CalendarSubscribe } from "@/components/site/calendar-subscribe";
import { LiveCard } from "@/components/site/live-card";

type Params = Promise<{ slug: string }>;

export default async function BandPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [band, lives] = await Promise.all([
    getBandBySlug(slug),
    getLivesByBandSlug(slug),
  ]);
  if (!band) notFound();

  const liveCount = lives.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 border-b border-[color:var(--color-border)] pb-6 md:flex-row md:items-start">
        {band.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={band.imageUrl}
            alt=""
            className="h-32 w-32 shrink-0 rounded-[var(--radius-lg)] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/works/${band.work.slug}`}
            className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
          >
            {band.work.nameKo}
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{band.nameKo}</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {band.nameJp}
            {band.nameEn ? ` · ${band.nameEn}` : ""}
          </p>
          {band.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">{band.description}</p>
          )}
          {band.officialUrl && (
            <a
              href={band.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-[color:var(--color-primary)] hover:underline"
            >
              공식 사이트 ↗
            </a>
          )}
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">라이브 {liveCount}건</h2>
        {liveCount === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
            아직 등록된 라이브가 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lives.map((live) => (
              <LiveCard key={live.id} live={live} />
            ))}
          </div>
        )}
      </section>

      <CalendarSubscribe feedPath={`/api/calendar?band=${encodeURIComponent(band.slug)}`} />
    </main>
  );
}
