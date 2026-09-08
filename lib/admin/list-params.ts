/**
 * 어드민 목록 페이지의 querystring 파라미터 (`?q=&page=`).
 *
 * 검색어와 페이지는 URL 이 단일 진실 원천이다 — 북마크/뒤로가기/공유가
 * 그대로 동작하고, 서버 컴포넌트가 searchParams 만 보고 렌더할 수 있다.
 */

/** 페이지당 행 수. 어드민 목록 전체 공통. */
export const PAGE_SIZE = 20;

export type ListParams = {
  /** 정규화된 검색어 (trim, 빈 문자열이면 undefined). */
  q?: string;
  /** 1-based 페이지 번호. */
  page: number;
};

function first(input: string | string[] | undefined): string | undefined {
  return Array.isArray(input) ? input[0] : input;
}

/**
 * `?q=&page=` 파싱. 잘못된 입력(0, 음수, 소수, 비숫자)은 1페이지로 떨어진다.
 */
export function parseListParams(sp: {
  q?: string | string[];
  page?: string | string[];
}): ListParams {
  const rawQ = first(sp.q)?.trim();
  const rawPage = first(sp.page);
  const parsed = rawPage === undefined ? NaN : Number(rawPage);
  const page =
    Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;

  return { q: rawQ ? rawQ : undefined, page };
}

/** Prisma `skip` / `take` 로 변환. */
export function toPrismaPage(params: ListParams): {
  skip: number;
  take: number;
} {
  return { skip: (params.page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** 전체 건수 기준 마지막 페이지 (0건이면 1). */
export function lastPage(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/**
 * 현재 파라미터에서 일부만 바꾼 querystring 생성.
 *
 * 기본값(page=1, q 없음)은 URL 에 남기지 않아 주소가 지저분해지지 않는다.
 */
export function buildListQuery(
  params: ListParams,
  patch: Partial<ListParams>
): string {
  const next = { ...params, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.page > 1) sp.set("page", String(next.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
