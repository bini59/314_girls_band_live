import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchVendors } from "@/lib/vendors/repo";

import { VendorsTable } from "./_components/VendorsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "판매처 관리 — 원정가고싶다",
};

/**
 * 어드민 발매처 마스터 페이지.
 *
 * - listVendors() 로 전체 목록을 server-side 페치.
 * - VendorsTable 에서 추가/편집/삭제 UI 제공.
 */
export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = parseListParams(await searchParams);
  const { rows: vendors, total } = await searchVendors({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          판매처 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          라이브의 판매 라운드(선행 / 일반 / 추첨 / 선착)에서 사용되는 발매처를
          관리합니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/vendors"
          q={params.q}
          placeholder="slug / 판매처명 검색"
        />

        <VendorsTable vendors={vendors} q={params.q} />

        <ListPagination
          basePath="/admin/vendors"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
