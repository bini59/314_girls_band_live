export function OgCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-background)] shadow-[var(--shadow-elevated)]"
    >
      <div className="aspect-square w-28 shrink-0 animate-pulse bg-[color:var(--color-muted)] sm:w-32" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-3">
        <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--color-muted)]" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-[color:var(--color-muted)]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[color:var(--color-muted)]" />
      </div>
    </div>
  );
}
