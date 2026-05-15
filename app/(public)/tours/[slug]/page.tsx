import Link from "next/link";
import { notFound } from "next/navigation";

import { CalendarSubscribe } from "@/components/site/calendar-subscribe";
import { LiveCard } from "@/components/site/live-card";
import { formatJstDate } from "@/lib/jst";

import {
  getTourBySlug,
  getLivesByTourSlug,
} from "@/lib/public/queries";

type Params = Promise<{ slug: string }>;

export default async function TourPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [tour, lives] = await Promise.all([
    getTourBySlug(slug),
    getLivesByTourSlug(slug),
  ]);
  if (!tour || tour.status !== "PUBLISHED") notFound();

  const dateRange = formatDateRange(tour.startsAt, tour.endsAt);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 border-b border-[color:var(--color-border)] pb-6 md:flex-row">
        {tour.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tour.posterUrl}
            alt=""
            className="aspect-[3/4] w-full max-w-[200px] shrink-0 rounded-[var(--radius-lg)] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/works/${tour.work.slug}`}
            className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
          >
            {tour.work.nameKo}
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {tour.nameKo}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {tour.nameJp}
            {tour.nameEn ? ` · ${tour.nameEn}` : ""}
          </p>
          {dateRange && (
            <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
              {dateRange}
            </p>
          )}
          {tour.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">
              {tour.description}
            </p>
          )}
          {tour.officialUrl && (
            <a
              href={tour.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-[color:var(--color-primary)] hover:underline"
            >
              공식 페이지 ↗
            </a>
          )}
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">회차 {lives.length}건</h2>
        {lives.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
            아직 등록된 회차가 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lives.map((live) => (
              <LiveCard key={live.id} live={live} />
            ))}
          </div>
        )}
      </section>

      <CalendarSubscribe
        feedPath={`/api/calendar?tour=${encodeURIComponent(tour.slug)}`}
      />
    </main>
  );
}

function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatJstDate(start)} – ${formatJstDate(end)}`;
  if (start) return `${formatJstDate(start)} –`;
  return `– ${formatJstDate(end as Date)}`;
}
