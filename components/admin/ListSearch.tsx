/**
 * 어드민 목록 검색창.
 *
 * form method=GET — 제출하면 브라우저가 `?q=...` 로 이동하므로 클라이언트
 * 상태나 JS 이벤트 핸들러가 필요 없다. 검색 시 page 는 리셋한다(hidden 없음).
 */
import Link from "next/link";

export function ListSearch({
  action,
  q,
  placeholder,
}: {
  /** 대상 페이지 경로 (예: /admin/lives). */
  action: string;
  /** 현재 검색어 — 입력창 기본값. */
  q?: string;
  placeholder: string;
}) {
  return (
    <form method="get" action={action} className="flex items-center gap-2" role="search">
      <input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        aria-label="검색"
        className="h-9 w-64 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm text-[color:var(--color-foreground)] outline-none transition-colors placeholder:text-[color:var(--color-muted-foreground)] focus-visible:border-[color:var(--color-ring)]"
      />
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm text-[color:var(--color-foreground)] hover:border-[color:var(--color-ring)]"
      >
        검색
      </button>
      {q ? (
        <Link
          href={action}
          className="text-sm text-[color:var(--color-muted-foreground)] no-underline hover:underline"
        >
          초기화
        </Link>
      ) : null}
    </form>
  );
}
