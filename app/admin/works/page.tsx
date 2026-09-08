import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchWorks } from "@/lib/works/repo";

import { WorksTable } from "./_components/WorksTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "작품 관리 — 원정가고싶다",
};

export default async function AdminWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = parseListParams(await searchParams);
  const { rows: works, total } = await searchWorks({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          작품 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          밴드(Band)의 상위 작품 마스터를 관리합니다. 시리즈 묶음은 선택사항.
          연결된 밴드가 있으면 삭제할 수 없습니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/works"
          q={params.q}
          placeholder="slug / 작품명 검색"
        />

        <WorksTable works={works} q={params.q} />

        <ListPagination
          basePath="/admin/works"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
