import { ListPagination } from "@/components/admin/ListPagination";
import { ListSearch } from "@/components/admin/ListSearch";

import { parseListParams, toPrismaPage } from "@/lib/admin/list-params";
import { requireAdminSession } from "@/lib/auth/guard";
import { searchApiKeys } from "@/lib/api-key/repo";

import { ApiKeysTable } from "./_components/ApiKeysTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API 키 관리 — 걸즈밴드 라이브",
};

/**
 * 어드민 API 키 관리 페이지.
 *
 * - listApiKeys() 로 전체 목록을 server-side 페치.
 * - ApiKeysTable 에서 발급/폐기 UI 제공. 평문은 발급 시 1회만 노출.
 */
export default async function AdminApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminSession();
  const params = parseListParams(await searchParams);
  const { rows: apiKeys, total } = await searchApiKeys({
    q: params.q,
    ...toPrismaPage(params),
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          API 키 관리
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          라이브 등록 공개 API 에 접근할 수 있는 명명 키를 발급하고 폐기합니다.
          발급된 평문 키는 발급 직후 1회만 표시되며 다시 볼 수 없습니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ListSearch
          action="/admin/api-keys"
          q={params.q}
          placeholder="키 이름 / prefix 검색"
        />

        <ApiKeysTable apiKeys={apiKeys} q={params.q} />

        <ListPagination
          basePath="/admin/api-keys"
          params={params}
          total={total}
        />
      </div>
    </div>
  );
}
