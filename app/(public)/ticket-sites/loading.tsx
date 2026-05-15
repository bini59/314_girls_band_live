import { OgCardSkeleton } from "@/components/site/og-card-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          티켓사이트 가입!!
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          일본 직관 가기 전에 — 티켓 사이트 회원가입과 유심 바로가기
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          추천 글
        </h2>
        <div className="grid gap-3">
          <OgCardSkeleton />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          티켓 사이트
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <OgCardSkeleton key={i} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[var(--tracking-caps)] text-[color:var(--color-muted-foreground)]">
          일본 유심 / eSIM
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <OgCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
