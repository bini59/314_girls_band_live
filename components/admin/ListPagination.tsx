/**
 * 어드민 목록 페이지네이션.
 *
 * 링크 기반(`?q=&page=`) — 서버 컴포넌트에서 그대로 렌더되고, 뒤로가기와
 * 새 탭 열기가 정상 동작한다. 전체 1페이지면 렌더하지 않는다.
 */
import Link from "next/link";

import {
  PAGE_SIZE,
  buildListQuery,
  lastPage,
  type ListParams,
} from "@/lib/admin/list-params";

export function ListPagination({
  basePath,
  params,
  total,
}: {
  /** 대상 페이지 경로 (예: /admin/lives). */
  basePath: string;
  params: ListParams;
  total: number;
}) {
  const last = lastPage(total);
  // 범위 밖 page(?page=99)는 행이 0건이므로 "1961–45" 같은 깨진 범위를 만들지 않는다.
  const rawFrom = (params.page - 1) * PAGE_SIZE + 1;
  const outOfRange = rawFrom > total;
  const from = total === 0 || outOfRange ? 0 : rawFrom;
  const to = outOfRange ? 0 : Math.min(params.page * PAGE_SIZE, total);

  const linkClass =
    "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm text-[color:var(--color-foreground)] no-underline hover:border-[color:var(--color-ring)] hover:no-underline";
  const disabledClass =
    "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm text-[color:var(--color-muted-foreground)] opacity-50";

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">
        {total === 0
          ? "결과 없음"
          : outOfRange
            ? `전체 ${total}건 — ${params.page}페이지는 범위를 벗어났습니다`
            : `전체 ${total}건 중 ${from}–${to}`}
      </p>

      {last > 1 || outOfRange ? (
        <nav className="flex items-center gap-2" aria-label="페이지">
          {outOfRange && total > 0 ? (
            // 범위 밖에서는 유효한 마지막 페이지로 돌아갈 길을 남긴다.
            <Link
              href={`${basePath}${buildListQuery(params, { page: last })}`}
              className={linkClass}
            >
              마지막 페이지로
            </Link>
          ) : params.page > 1 ? (
            <Link
              href={`${basePath}${buildListQuery(params, { page: params.page - 1 })}`}
              className={linkClass}
              rel="prev"
            >
              이전
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled="true">
              이전
            </span>
          )}

          {outOfRange ? null : (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {params.page} / {last}
            </span>
          )}

          {outOfRange ? null : params.page < last ? (
            <Link
              href={`${basePath}${buildListQuery(params, { page: params.page + 1 })}`}
              className={linkClass}
              rel="next"
            >
              다음
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled="true">
              다음
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
