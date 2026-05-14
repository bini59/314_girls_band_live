/**
 * 본 사이클 범위 밖 섹션(밴드/포맷/티어/라운드/노트)의 placeholder.
 *
 * TODO(cycle-C ~): 각 섹션을 실제 컴포넌트로 교체.
 */
export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted)]/20 p-6 text-sm text-[color:var(--color-muted-foreground)]">
      <h2 className="text-base font-semibold text-[color:var(--color-foreground)]">
        {title}
      </h2>
      <p className="mt-1">{description}</p>
      <p className="mt-2 text-xs uppercase tracking-wide">
        다음 사이클에서 추가
      </p>
    </section>
  );
}
