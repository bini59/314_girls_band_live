/**
 * iCal(RFC 5545) 피드 빌더.
 *
 * - 모든 시각은 UTC로 출력 (DTSTART:YYYYMMDDTHHMMSSZ).
 * - 줄 단위 CRLF + 75 octet 줄폴딩.
 * - UID는 안정적이어야 함 → live-{slug}@host
 */
import type { PublicLive } from "@/lib/public/queries";

const CRLF = "\r\n";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function escapeText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 §3.1 줄 폴딩 — 75 octets 초과 시 CRLF + space. */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const chunk = bytes.subarray(i, i + (i === 0 ? 75 : 74));
    out.push(chunk.toString("utf-8"));
    i += chunk.length;
  }
  return out.join(`${CRLF} `);
}

type SerializedLive = Omit<PublicLive, "startAt" | "doorsOpenAt" | "endAt"> & {
  startAt: string;
  doorsOpenAt: string | null;
  endAt: string | null;
};

export function buildIcs({
  lives,
  host,
  calendarName,
  scope,
}: {
  lives: SerializedLive[];
  host: string;
  calendarName: string;
  scope?: string;
}): string {
  const now = new Date();
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//girls_band_live//KO");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeText(calendarName)}`);
  lines.push("X-WR-TIMEZONE:Asia/Tokyo");
  if (scope) lines.push(`X-WR-CALDESC:${escapeText(scope)}`);

  for (const live of lives) {
    const start = new Date(live.startAt);
    // 종료시각이 없으면 +3시간으로 가정.
    const end = live.endAt
      ? new Date(live.endAt)
      : new Date(start.getTime() + 3 * 60 * 60 * 1000);

    const bands = live.liveBands.map((lb) => lb.band.nameKo).join(", ");
    const summary = bands ? `${live.titleKo} — ${bands}` : live.titleKo;
    const descLines: string[] = [];
    if (live.titleJp && live.titleJp !== live.titleKo) descLines.push(`원제: ${live.titleJp}`);
    if (bands) descLines.push(`출연: ${bands}`);
    descLines.push(`상세: https://${host}/lives/${live.slug}`);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:live-${live.slug}@${host}`);
    lines.push(`DTSTAMP:${toIcsUtc(now)}`);
    lines.push(`DTSTART:${toIcsUtc(start)}`);
    lines.push(`DTEND:${toIcsUtc(end)}`);
    lines.push(`SUMMARY:${escapeText(summary)}`);
    lines.push(`LOCATION:${escapeText(live.venueName)}`);
    lines.push(`DESCRIPTION:${escapeText(descLines.join("\n"))}`);
    lines.push(`URL:https://${host}/lives/${live.slug}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}
