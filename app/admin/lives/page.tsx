import Link from "next/link";

import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import {
  parseListParams,
  toPrismaPage,
} from "@/lib/admin/list-params";
import { searchLivesForAdmin } from "@/lib/live/repo";

import { LivesTable } from "./_components/LivesTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "라이브 관리 — 원정가고싶다",
};

/**
 * 어드민 라이브 목록.
 *
 * 검색어/페이지는 querystring(`?q=&page=`)이 단일 진실 원천 — 서버에서
 * 그대로 조회하므로 북마크·뒤로가기·공유가 동작한다.
 */
export default async function AdminLivesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = parseListParams(await searchParams);
  const { rows: lives, total } = await searchLivesForAdmin({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-foreground)]">
            라이브 관리
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            등록된 라이브를 관리하고 새 공연을 추가합니다.
          </p>
        </div>
        <Link
          href="/admin/lives/new"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-accent px-3 text-[13px] font-medium text-accent-fg no-underline hover:opacity-[.88] hover:no-underline"
        >
          + 새 라이브
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/lives"
          q={params.q}
          placeholder="제목 / 공연장 검색"
        />

        {lives.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] py-12 text-center">
            <p className="text-base text-[color:var(--color-muted-foreground)]">
              {params.q
                ? `"${params.q}" 검색 결과가 없습니다.`
                : "아직 라이브가 없습니다."}
            </p>
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              {params.q
                ? "다른 검색어를 시도해보세요."
                : "상단의 버튼으로 첫 라이브를 등록해보세요."}
            </p>
          </div>
        ) : (
          <LivesTable lives={lives} />
        )}

        <ListPagination basePath="/admin/lives" params={params} total={total} />
      </div>
    </div>
  );
}
