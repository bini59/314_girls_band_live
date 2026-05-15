"use client";

import Link from "next/link";
import * as React from "react";

import {
  formatJstHuman,
  formatJstTime,
  jstDateKey,
  WEEKDAY_LABELS,
} from "@/lib/jst";
import type { PublicLive } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  SOLO: "단독",
  TAIBAN: "대반",
  FES: "페스",
};

const TYPE_DOT: Record<string, string> = {
  SOLO: "bg-[color:var(--color-primary)]",
  TAIBAN: "bg-[color:var(--color-warning)]",
  FES: "bg-[color:var(--color-info)]",
};

type SerializedLive = Omit<PublicLive, "startAt" | "doorsOpenAt" | "endAt"> & {
  startAt: string;
  doorsOpenAt: string | null;
  endAt: string | null;
};

export function CalendarView({
  year,
  month,
  lives,
  todayKey,
}: {
  year: number;
  month: number; // 1-12
  lives: SerializedLive[];
  todayKey: string;
}) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const livesByDay = React.useMemo(() => {
    const map = new Map<string, SerializedLive[]>();
    for (const live of lives) {
      const key = jstDateKey(new Date(live.startAt));
      const arr = map.get(key);
      if (arr) arr.push(live);
      else map.set(key, [live]);
    }
    return map;
  }, [lives]);

  const selected = React.useMemo(
    () => lives.find((l) => l.id === selectedId) ?? null,
    [lives, selectedId]
  );

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-background)]">
        <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tabular-nums">
              {year}년 {month}월
            </h2>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">JST</span>
          </div>
          <nav aria-label="달 이동" className="flex items-center gap-1">
            <Link
              href={`/?ym=${prev.y}-${String(prev.m).padStart(2, "0")}`}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-muted)]"
              aria-label="이전 달"
            >
              ◀
            </Link>
            <Link
              href="/"
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-muted)]"
            >
              오늘
            </Link>
            <Link
              href={`/?ym=${next.y}-${String(next.m).padStart(2, "0")}`}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-muted)]"
              aria-label="다음 달"
            >
              ▶
            </Link>
          </nav>
        </header>

        {/* 데스크탑: 월 그리드 */}
        <div className="hidden md:block">
          <MonthGrid
            year={year}
            month={month}
            livesByDay={livesByDay}
            todayKey={todayKey}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* 모바일: 주간 아젠다 */}
        <div className="md:hidden">
          <AgendaList
            year={year}
            month={month}
            lives={lives}
            todayKey={todayKey}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <SidePanel live={selected} onClose={() => setSelectedId(null)} />
      </aside>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  livesByDay,
  todayKey,
  selectedId,
  onSelect,
}: {
  year: number;
  month: number;
  livesByDay: Map<string, SerializedLive[]>;
  todayKey: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  // JST 기준 1일 weekday/마지막일.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 text-center text-xs font-medium text-[color:var(--color-muted-foreground)]">
        {WEEKDAY_LABELS.map((wd, i) => (
          <div
            key={wd}
            className={cn(
              "py-2",
              i === 0 && "text-[color:var(--color-destructive)]",
              i === 6 && "text-[color:var(--color-info)]"
            )}
          >
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:not(:nth-child(7n))]:border-r [&>*]:border-b [&>*]:border-[color:var(--color-border)]">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - firstWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const dateKey = inMonth
            ? `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            : null;
          const dayLives = dateKey ? livesByDay.get(dateKey) ?? [] : [];
          const weekday = i % 7;
          const isToday = dateKey === todayKey;

          return (
            <div
              key={i}
              className={cn(
                "flex min-h-[6rem] flex-col p-1.5",
                !inMonth && "bg-[color:var(--color-muted)]/30"
              )}
            >
              {inMonth && (
                <div
                  className={cn(
                    "mb-1 inline-flex h-5 w-5 items-center justify-center self-start text-xs tabular-nums",
                    weekday === 0 && "text-[color:var(--color-destructive)]",
                    weekday === 6 && "text-[color:var(--color-info)]",
                    isToday &&
                      "rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                  )}
                >
                  {dayNum}
                </div>
              )}
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayLives.map((live) => (
                  <button
                    key={live.id}
                    type="button"
                    onClick={() => onSelect(live.id)}
                    className={cn(
                      "group flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-1 text-left text-[11px]",
                      "hover:bg-[color:var(--color-muted)]",
                      selectedId === live.id &&
                        "bg-[color:var(--color-primary)]/12 ring-1 ring-[color:var(--color-primary)]/40"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        TYPE_DOT[live.type] ?? "bg-[color:var(--color-foreground)]"
                      )}
                    />
                    <span className="shrink-0 tabular-nums text-[color:var(--color-muted-foreground)]">
                      {formatJstTime(new Date(live.startAt))}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{live.titleKo}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  year,
  month,
  lives,
  todayKey,
  selectedId,
  onSelect,
}: {
  year: number;
  month: number;
  lives: SerializedLive[];
  todayKey: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  // 빈 일자도 포함해서 일자별로 그룹.
  const days = React.useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const map = new Map<string, SerializedLive[]>();
    for (const live of lives) {
      const key = jstDateKey(new Date(live.startAt));
      const arr = map.get(key);
      if (arr) arr.push(live);
      else map.set(key, [live]);
    }
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, key, lives: map.get(key) ?? [] };
    }).filter((d) => d.lives.length > 0 || d.key === todayKey);
  }, [year, month, lives, todayKey]);

  if (days.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
        이번 달 예정된 라이브가 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--color-border)]">
      {days.map(({ day, key, lives: dayLives }) => {
        const date = new Date(Date.UTC(year, month - 1, day));
        const weekday = date.getUTCDay();
        const isToday = key === todayKey;
        return (
          <li key={key} className="px-4 py-3">
            <div
              className={cn(
                "mb-2 flex items-baseline gap-2 text-sm font-semibold",
                weekday === 0 && "text-[color:var(--color-destructive)]",
                weekday === 6 && "text-[color:var(--color-info)]"
              )}
            >
              <span className="tabular-nums">{day}일</span>
              <span className="text-xs font-normal text-[color:var(--color-muted-foreground)]">
                ({WEEKDAY_LABELS[weekday]})
              </span>
              {isToday && (
                <span className="rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-primary-foreground)]">
                  오늘
                </span>
              )}
            </div>
            {dayLives.length === 0 ? (
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                예정 없음
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dayLives.map((live) => (
                  <li key={live.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(live.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-2 text-left text-sm hover:bg-[color:var(--color-muted)]",
                        selectedId === live.id &&
                          "border-[color:var(--color-primary)]/50 bg-[color:var(--color-primary)]/10"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          TYPE_DOT[live.type] ?? "bg-[color:var(--color-foreground)]"
                        )}
                      />
                      <span className="shrink-0 tabular-nums text-xs text-[color:var(--color-muted-foreground)]">
                        {formatJstTime(new Date(live.startAt))}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {live.titleKo}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SidePanel({
  live,
  onClose,
}: {
  live: SerializedLive | null;
  onClose: () => void;
}) {
  if (!live) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-muted-foreground)]">
        <p className="font-medium text-[color:var(--color-foreground)]">
          일정을 선택하세요
        </p>
        <p className="mt-1">달력에서 라이브 항목을 클릭하면 여기에 정보가 표시됩니다.</p>
      </div>
    );
  }

  const bands = live.liveBands.map((lb) => lb.band);

  return (
    <article className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-background)]">
      {(live.thumbnailUrl || live.posterUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={live.thumbnailUrl ?? live.posterUrl ?? ""}
          alt=""
          className="aspect-[16/9] w-full rounded-t-[var(--radius-lg)] object-cover"
        />
      )}
      <div className="space-y-3 p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-[color:var(--color-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {TYPE_LABEL[live.type] ?? live.type}
            </span>
            <h3 className="text-base font-semibold leading-snug">{live.titleKo}</h3>
            {live.titleJp && live.titleJp !== live.titleKo && (
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                {live.titleJp}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"
          >
            ✕
          </button>
        </header>

        <dl className="space-y-2 text-sm">
          <Field label="일시">{formatJstHuman(new Date(live.startAt))}</Field>
          {live.doorsOpenAt && (
            <Field label="개장">{formatJstHuman(new Date(live.doorsOpenAt))}</Field>
          )}
          <Field label="장소">{live.venueName}</Field>
          {bands.length > 0 && (
            <Field label="출연">
              <ul className="flex flex-wrap gap-1.5">
                {bands.map((band) => (
                  <li key={band.id}>
                    <Link
                      href={`/bands/${band.slug}`}
                      className="rounded-full bg-[color:var(--color-muted)] px-2 py-0.5 text-xs hover:bg-[color:var(--color-muted)]/70"
                    >
                      {band.nameKo}
                    </Link>
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </dl>

        <div className="border-t border-[color:var(--color-border)] pt-3">
          <Link
            href={`/lives/${live.slug}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] hover:opacity-90"
          >
            자세히 보기 →
          </Link>
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-12 shrink-0 text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="flex-1 break-words">{children}</dd>
    </div>
  );
}

export type { SerializedLive };
