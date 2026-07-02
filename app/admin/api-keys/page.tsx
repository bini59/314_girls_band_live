import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listApiKeys } from "@/lib/api-key/repo";

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
export default async function AdminApiKeysPage() {
  await requireAdminSession();
  const apiKeys = await listApiKeys();

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

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <ApiKeysTable apiKeys={apiKeys} />
        </CardContent>
      </Card>
    </div>
  );
}
