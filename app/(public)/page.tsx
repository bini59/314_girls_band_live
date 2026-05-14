import { jstMonthRange, jstToday } from "@/lib/jst";
import { getLivesInRange } from "@/lib/public/queries";

import { CalendarSubscribe } from "@/components/site/calendar-subscribe";
import { CalendarView } from "@/components/site/calendar-view";

function parseYm(input: string | string[] | undefined): { year: number; month: number } | null {
  const v = Array.isArray(input) ? input[0] : input;
  if (!v) return null;
  const m = /^(\d{4})-(\d{1,2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

type SearchParams = Promise<{ ym?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const today = jstToday();
  const parsed = parseYm(sp.ym);
  const { year, month } = parsed ?? today;

  const { start, end } = jstMonthRange(year, month);
  const lives = await getLivesInRange(start, end);
  const todayKey = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;

  const serialized = lives.map((l) => ({
    ...l,
    startAt: l.startAt.toISOString(),
    doorsOpenAt: l.doorsOpenAt?.toISOString() ?? null,
    endAt: l.endAt?.toISOString() ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">라이브 캘린더</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            일본 걸즈밴드 라이브 일정 — JST 표시. 항목을 클릭하면 우측에 정보가 나타납니다.
          </p>
        </div>
      </div>

      <CalendarView
        year={year}
        month={month}
        lives={serialized}
        todayKey={todayKey}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CalendarSubscribe feedPath="/api/calendar" />
      </div>
    </main>
  );
}
