import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchTours } from "@/lib/tours/repo";

import { ToursTable } from "./_components/ToursTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "투어 관리 — 원정가고싶다",
};

export default async function AdminToursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = parseListParams(await searchParams);
  const { rows: tours, total } = await searchTours({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          투어 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          전국 투어/단독 시리즈를 묶는 단위(예: 결속밴드 We will B, 학마스
          LIVE TOUR 標). 회차(Live)는 라이브 페이지에서 투어를 선택하여 연결합니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/tours"
          q={params.q}
          placeholder="slug / 투어명 검색"
        />

        <ToursTable tours={tours} q={params.q} />

        <ListPagination
          basePath="/admin/tours"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
