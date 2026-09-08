import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchBandsForAdmin } from "@/lib/band/repo";
import { listWorks } from "@/lib/works/repo";

import { BandsTable } from "./_components/BandsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "밴드 관리 — 원정가고싶다",
};

/**
 * 작품 필터도 querystring(`?workId=`)에 담는다 — 검색어/페이지와 함께
 * 북마크·공유가 동작해야 하므로 클라이언트 상태로 두지 않는다.
 */
export default async function AdminBandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; workId?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;
  const params = parseListParams(sp);
  const parsedWorkId = Number(sp.workId);
  const workId = Number.isSafeInteger(parsedWorkId) && parsedWorkId > 0
    ? parsedWorkId
    : undefined;

  const [{ rows: bands, total }, works] = await Promise.all([
    searchBandsForAdmin({ q: params.q, workId, ...toPrismaPage(params) }),
    listWorks(),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          밴드 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          작품(Work) 내 밴드 마스터를 관리합니다. 라이브 출연 이력이 있는 밴드는
          삭제할 수 없습니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListSearch
            action="/admin/bands"
            q={params.q}
            placeholder="slug / 밴드명 검색"
          />
        </div>

        <BandsTable
          bands={bands}
          works={works}
          q={params.q}
          selectedWorkId={workId}
        />

        <ListPagination
          basePath="/admin/bands"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
