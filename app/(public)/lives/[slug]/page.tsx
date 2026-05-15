import Link from "next/link";
import { notFound } from "next/navigation";

import {
  LIVE_FORMAT_TYPE_LABELS,
  TICKET_SALE_METHOD_LABELS,
  TICKET_SALE_TYPE_LABELS,
  formatJpy,
} from "@/app/admin/lives/[id]/_components/ticket-sale-labels";
import { Markdown } from "@/components/ui/markdown";
import { formatJstHuman } from "@/lib/jst";
import { getLiveBySlug } from "@/lib/public/queries";

const TYPE_LABEL: Record<string, string> = {
  SOLO: "단독 공연",
  TAIBAN: "대반",
  FES: "페스",
};

type Params = Promise<{ slug: string }>;

export default async function LiveDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const live = await getLiveBySlug(slug);
  if (!live || live.status !== "PUBLISHED") notFound();

  const officialUrls = Array.isArray(live.officialUrls)
    ? (live.officialUrls as string[])
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <article>
        <header className="mb-6 flex flex-col gap-4 border-b border-[color:var(--color-border)] pb-6 md:flex-row">
          {live.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={live.posterUrl}
              alt=""
              className="aspect-[3/4] w-full max-w-[200px] shrink-0 rounded-[var(--radius-lg)] object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-[color:var(--color-muted)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                {TYPE_LABEL[live.type] ?? live.type}
              </span>
              {live.tour && live.tour.status === "PUBLISHED" && (
                <Link
                  href={`/tours/${live.tour.slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary)]/15 px-2 py-0.5 text-xs font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/25"
                >
                  투어 · {live.tour.nameKo}
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">
              {live.titleKo}
            </h1>
            {live.titleJp && live.titleJp !== live.titleKo && (
              <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                {live.titleJp}
              </p>
            )}

            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow label="개연">{formatJstHuman(new Date(live.startAt))}</DetailRow>
              {live.doorsOpenAt && (
                <DetailRow label="개장">
                  {formatJstHuman(new Date(live.doorsOpenAt))}
                </DetailRow>
              )}
              <DetailRow label="장소">
                {live.venueUrl ? (
                  <a
                    href={live.venueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {live.venueName}
                  </a>
                ) : (
                  live.venueName
                )}
                {live.venueAddress && (
                  <span className="ml-2 text-xs text-[color:var(--color-muted-foreground)]">
                    {live.venueAddress}
                  </span>
                )}
              </DetailRow>
              {live.ticketRestrictions && (
                <DetailRow label="주의">{live.ticketRestrictions}</DetailRow>
              )}
              {officialUrls.length > 0 && (
                <DetailRow label="공식">
                  <ul className="space-y-1">
                    {officialUrls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[color:var(--color-primary)] hover:underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </DetailRow>
              )}
            </dl>
          </div>
        </header>

        {/* 출연 밴드 */}
        {live.liveBands.length > 0 && (
          <Section title="출연">
            <ul className="flex flex-wrap gap-2">
              {live.liveBands.map(({ band, isHeadliner }) => (
                <li key={band.id}>
                  <Link
                    href={`/bands/${band.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-3 py-1 text-sm hover:bg-[color:var(--color-muted)]"
                  >
                    {isHeadliner && (
                      <span className="rounded-full bg-[color:var(--color-primary)] px-1.5 text-[10px] font-semibold uppercase text-[color:var(--color-primary-foreground)]">
                        Headline
                      </span>
                    )}
                    <span className="font-medium">{band.nameKo}</span>
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">
                      {band.work.nameKo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 포맷 + 좌석 */}
        {live.formats.length > 0 && (
          <Section title="관람 형식 / 좌석">
            <div className="grid gap-3 sm:grid-cols-2">
              {live.formats.map((fmt) => (
                <div
                  key={fmt.id}
                  className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {LIVE_FORMAT_TYPE_LABELS[fmt.type]}
                      {fmt.label ? ` — ${fmt.label}` : ""}
                    </h3>
                    {fmt.url && (
                      <a
                        href={fmt.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[color:var(--color-primary)] hover:underline"
                      >
                        링크 ↗
                      </a>
                    )}
                  </div>
                  {fmt.venueName && (
                    <p className="text-xs text-[color:var(--color-muted-foreground)]">
                      {fmt.venueName}
                    </p>
                  )}
                  {fmt.tiers.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {fmt.tiers.map((tier) => (
                        <li
                          key={tier.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>{tier.name}</span>
                          <span className="font-mono text-xs tabular-nums">
                            {formatJpy(tier.priceJpy)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
                      좌석 정보 미등록
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 판매 라운드 */}
        {live.ticketSales.length > 0 && (
          <Section title="티켓 판매 / 추첨">
            <ul className="space-y-3">
              {live.ticketSales.map((sale) => (
                <li
                  key={sale.id}
                  className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded-full bg-[color:var(--color-muted)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                        {TICKET_SALE_TYPE_LABELS[sale.type]}
                      </span>
                      <span className="rounded-full bg-[color:var(--color-primary)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-primary)]">
                        {TICKET_SALE_METHOD_LABELS[sale.method]}
                      </span>
                      {sale.label && (
                        <span className="text-sm font-medium">{sale.label}</span>
                      )}
                    </div>
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">
                      {sale.vendor.name}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <DetailRow label="개시">
                      {formatJstHuman(new Date(sale.startsAt))}
                    </DetailRow>
                    {sale.endsAt && (
                      <DetailRow label="마감">
                        {formatJstHuman(new Date(sale.endsAt))}
                      </DetailRow>
                    )}
                    {sale.announceAt && (
                      <DetailRow label="당첨발표">
                        {formatJstHuman(new Date(sale.announceAt))}
                      </DetailRow>
                    )}
                    {sale.paymentDeadlineAt && (
                      <DetailRow label="입금기한">
                        {formatJstHuman(new Date(sale.paymentDeadlineAt))}
                      </DetailRow>
                    )}
                  </dl>

                  {sale.tiers.length > 0 && (
                    <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
                      대상 좌석:{" "}
                      {sale.tiers.map((t) => t.tier.name).join(", ")}
                    </p>
                  )}

                  {sale.url && (
                    <a
                      href={sale.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs text-[color:var(--color-primary)] hover:underline"
                    >
                      판매 페이지 ↗
                    </a>
                  )}
                  {sale.notes && (
                    <div className="mt-2 text-[color:var(--color-muted-foreground)]">
                      <Markdown size="sm">{sale.notes}</Markdown>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {live.notes && (
          <Section title="비고">
            <Markdown>{live.notes}</Markdown>
          </Section>
        )}
      </article>
    </main>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="flex-1 break-words">{children}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
