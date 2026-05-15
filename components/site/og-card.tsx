/* eslint-disable @next/next/no-img-element */
import type { OgData } from "@/lib/og-fetch";

/**
 * 디시인사이드 임베드 카드 스타일의 OG 미리보기.
 * - 좌측: og:image (없으면 favicon 박스)
 * - 우측: 제목 / 설명 / 도메인
 */
export function OgCard({
  og,
  fallbackLabel,
}: {
  og: OgData;
  fallbackLabel?: string;
}) {
  const title = og.title ?? og.siteName ?? fallbackLabel ?? og.host;
  const description = og.description;

  return (
    <a
      href={og.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-background)] shadow-[var(--shadow-elevated)] transition hover:bg-[color:var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
    >
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden bg-[color:var(--color-muted)] sm:w-32">
        {og.image ? (
          <img
            src={og.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={og.favicon}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-12 w-12 object-contain"
            />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src={og.favicon}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-4 w-4 shrink-0 object-contain"
          />
          <span className="truncate text-[11px] font-bold uppercase tracking-[var(--tracking-button)] text-[color:var(--color-muted-foreground)]">
            {og.host}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[color:var(--color-foreground)] sm:text-base">
          {title}
        </h3>
        {description && (
          <p className="line-clamp-2 text-xs leading-snug text-[color:var(--color-muted-foreground)]">
            {description}
          </p>
        )}
      </div>
    </a>
  );
}
