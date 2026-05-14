import Link from "next/link";

import { formatJstHuman } from "@/lib/jst";
import type { PublicLive } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  SOLO: "단독",
  TAIBAN: "대반",
  FES: "페스",
};

const TYPE_TONE: Record<string, string> = {
  SOLO: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]",
  TAIBAN: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
  FES: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
};

export function LiveCard({ live }: { live: PublicLive }) {
  const bands = live.liveBands.map((lb) => lb.band);
  const headliner = live.liveBands.find((lb) => lb.isHeadliner)?.band ?? bands[0];

  return (
    <Link
      href={`/lives/${live.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-background)] transition",
        "hover:bg-[color:var(--color-surface-2)] hover:shadow-[var(--shadow-elevated)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
      )}
    >
      {live.thumbnailUrl || live.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={live.thumbnailUrl ?? live.posterUrl ?? ""}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-[color:var(--color-muted)] text-3xl">
          🎤
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[var(--tracking-button)]",
              TYPE_TONE[live.type] ?? "bg-[color:var(--color-muted)]"
            )}
          >
            {TYPE_LABEL[live.type] ?? live.type}
          </span>
          {headliner && (
            <span className="truncate text-xs text-[color:var(--color-muted-foreground)]">
              {headliner.nameKo}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-bold leading-snug">
          {live.titleKo}
        </h3>

        <dl className="mt-auto space-y-1 text-xs text-[color:var(--color-muted-foreground)]">
          <div className="flex gap-1.5">
            <dt aria-label="일시">🗓</dt>
            <dd>{formatJstHuman(new Date(live.startAt))}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt aria-label="장소">📍</dt>
            <dd className="truncate">{live.venueName}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
