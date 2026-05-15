import Link from "next/link";
import { notFound } from "next/navigation";

import { getLivesByWorkSlug, getWorkBySlug } from "@/lib/public/queries";

import { CalendarSubscribe } from "@/components/site/calendar-subscribe";
import { LiveCard } from "@/components/site/live-card";

type Params = Promise<{ slug: string }>;

export default async function WorkPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [work, lives] = await Promise.all([
    getWorkBySlug(slug),
    getLivesByWorkSlug(slug),
  ]);
  if (!work) notFound();

  const liveCount = lives.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6 border-b border-[color:var(--color-border)] pb-6">
        {work.series && (
          <Link
            href={`/?series=${work.series.slug}`}
            className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
          >
            {work.series.nameKo}
          </Link>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{work.nameKo}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          {work.nameJp}
          {work.nameEn ? ` · ${work.nameEn}` : ""}
        </p>
        {work.description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed">{work.description}</p>
        )}

        {work.bands.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              밴드 {work.bands.length}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {work.bands.map((band) => (
                <li key={band.id}>
                  <Link
                    href={`/bands/${band.slug}`}
                    className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-sm hover:bg-[color:var(--color-muted)]"
                  >
                    {band.nameKo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {work.tours.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              투어 {work.tours.length}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {work.tours.map((tour) => (
                <li key={tour.id}>
                  <Link
                    href={`/tours/${tour.slug}`}
                    className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-sm hover:bg-[color:var(--color-muted)]"
                  >
                    {tour.nameKo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
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

      <CalendarSubscribe feedPath={`/api/calendar?work=${encodeURIComponent(work.slug)}`} />
    </main>
  );
}
