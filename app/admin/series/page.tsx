import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchSeries } from "@/lib/series/repo";

import { SeriesTable } from "./_components/SeriesTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "시리즈 관리 — 원정가고싶다",
};

export default async function AdminSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = parseListParams(await searchParams);
  const { rows: series, total } = await searchSeries({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          시리즈 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          작품(Work)의 상위 묶음인 시리즈/IP 마스터를 관리합니다. 시리즈 삭제 시
          연결된 작품은 분리(시리즈 없음)됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/series"
          q={params.q}
          placeholder="slug / 시리즈명 검색"
        />

        <SeriesTable series={series} q={params.q} />

        <ListPagination
          basePath="/admin/series"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
