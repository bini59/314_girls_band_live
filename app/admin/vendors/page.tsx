import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listVendors } from "@/lib/vendors/repo";

import { VendorsTable } from "./_components/VendorsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "판매처 관리 — 걸즈밴드 라이브",
};

/**
 * 어드민 발매처 마스터 페이지.
 *
 * - listVendors() 로 전체 목록을 server-side 페치.
 * - VendorsTable 에서 추가/편집/삭제 UI 제공.
 */
export default async function AdminVendorsPage() {
  await requireAdminSession();
  const vendors = await listVendors();

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

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <VendorsTable vendors={vendors} />
        </CardContent>
      </Card>
    </div>
  );
}
