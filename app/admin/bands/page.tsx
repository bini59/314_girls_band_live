import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listBands } from "@/lib/band/repo";
import { listWorks } from "@/lib/works/repo";

import { BandsTable } from "./_components/BandsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "밴드 관리 — 걸즈밴드 라이브",
};

export default async function AdminBandsPage() {
  await requireAdminSession();
  const [bands, works] = await Promise.all([listBands(), listWorks()]);

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

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <BandsTable bands={bands} works={works} />
        </CardContent>
      </Card>
    </div>
  );
}
