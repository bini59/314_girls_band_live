"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 캘린더 구독 패널.
 *
 * - webcal://  → Apple/macOS/iOS, Samsung 캘린더 등 OS 표준 구독
 * - Google Calendar Add URL → https://calendar.google.com/calendar/u/0/r?cid=...
 * - .ics 다운로드 / 클립보드 복사 → Notion Calendar, Outlook 등
 */
export function CalendarSubscribe({ feedPath }: { feedPath: string }) {
  const [origin, setOrigin] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const httpsUrl = origin ? `${origin}${feedPath}` : "";
  const webcalUrl = origin
    ? `${origin.replace(/^https?:/, "webcal:")}${feedPath}`
    : "";
  const googleUrl = httpsUrl
    ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(httpsUrl)}`
    : "";

  async function copy() {
    if (!httpsUrl) return;
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <section
      aria-label="캘린더 구독"
      className="rounded-[var(--radius-lg)] bg-[color:var(--color-background)] p-5"
    >
      <header className="mb-3">
        <h3 className="text-sm font-bold tracking-tight">캘린더 구독</h3>
        <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
          한 번 구독하면 새 일정이 추가될 때 자동 반영됩니다 (JST 기준).
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <SubBtn
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          label="Google"
          hint="Google Calendar에 추가"
        />
        <SubBtn
          href={webcalUrl}
          label="Apple"
          hint="iOS / macOS 캘린더 (webcal://)"
        />
        <SubBtn
          href={webcalUrl}
          label="Samsung"
          hint="삼성 캘린더 (webcal://)"
        />
        <SubBtn
          href={httpsUrl}
          download
          label="Notion · 기타"
          hint=".ics 파일 다운로드"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={httpsUrl}
          className="w-full truncate rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-1.5 text-xs shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] outline-none"
          aria-label="구독 URL"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full bg-[color:var(--color-muted)] px-3 py-1.5 text-xs font-bold tracking-[var(--tracking-button)] text-[color:var(--color-foreground)] transition hover:bg-[color:var(--color-surface-2)]"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </section>
  );
}

function SubBtn({
  href,
  label,
  hint,
  target,
  rel,
  download,
}: {
  href: string;
  label: string;
  hint: string;
  target?: string;
  rel?: string;
  download?: boolean;
}) {
  return (
    <a
      href={href || "#"}
      target={target}
      rel={rel}
      download={download}
      aria-disabled={!href}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-[var(--radius-lg)] bg-[color:var(--color-muted)] px-3 py-2.5 text-left transition",
        href
          ? "hover:bg-[color:var(--color-surface-2)] hover:shadow-[var(--shadow-elevated)]"
          : "cursor-not-allowed opacity-50"
      )}
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="text-[10px] text-[color:var(--color-muted-foreground)]">
        {hint}
      </span>
    </a>
  );
}
