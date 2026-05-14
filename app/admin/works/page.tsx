import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listSeries } from "@/lib/series/repo";
import { listWorks } from "@/lib/works/repo";

import { WorksTable } from "./_components/WorksTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "작품 관리 — 걸즈밴드 라이브",
};

export default async function AdminWorksPage() {
  await requireAdminSession();
  const [works, series] = await Promise.all([listWorks(), listSeries()]);

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

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <WorksTable works={works} series={series} />
        </CardContent>
      </Card>
    </div>
  );
}
