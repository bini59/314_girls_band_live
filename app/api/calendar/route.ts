import type { NextRequest } from "next/server";

import { buildIcs } from "@/lib/public/ical";
import {
  getLivesByBandSlug,
  getLivesByTourSlug,
  getLivesByWorkSlug,
  getLivesInRange,
} from "@/lib/public/queries";

export const dynamic = "force-dynamic";

/**
 * iCal 구독 피드.
 *
 * 쿼리:
 *   ?tour=slug → 해당 투어의 모든 회차
 *   ?work=slug → 해당 작품의 모든 라이브
 *   ?band=slug → 해당 밴드의 모든 라이브
 *   (없음)     → 전체 (다가오는 + 지난 6개월)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tourSlug = searchParams.get("tour");
  const workSlug = searchParams.get("work");
  const bandSlug = searchParams.get("band");

  let lives;
  let calendarName = "걸즈밴드 라이브";
  let scope: string | undefined;
  let suffix = "";

  if (tourSlug) {
    lives = await getLivesByTourSlug(tourSlug);
    calendarName = `걸즈밴드 라이브 — ${tourSlug}`;
    scope = `투어: ${tourSlug}`;
    suffix = `-${tourSlug}`;
  } else if (bandSlug) {
    lives = await getLivesByBandSlug(bandSlug);
    calendarName = `걸즈밴드 라이브 — ${bandSlug}`;
    scope = `밴드: ${bandSlug}`;
    suffix = `-${bandSlug}`;
  } else if (workSlug) {
    lives = await getLivesByWorkSlug(workSlug);
    calendarName = `걸즈밴드 라이브 — ${workSlug}`;
    scope = `작품: ${workSlug}`;
    suffix = `-${workSlug}`;
  } else {
    const now = new Date();
    const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    lives = await getLivesInRange(start, end);
  }

  const host = req.headers.get("host") ?? "localhost";
  const ics = buildIcs({
    lives: lives.map((l) => ({
      ...l,
      startAt: l.startAt.toISOString(),
      doorsOpenAt: l.doorsOpenAt?.toISOString() ?? null,
      endAt: l.endAt?.toISOString() ?? null,
    })),
    host,
    calendarName,
    scope,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": `inline; filename="girls-band-live${suffix}.ics"`,
    },
  });
}
