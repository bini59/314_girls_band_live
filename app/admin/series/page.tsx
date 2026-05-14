import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listSeries } from "@/lib/series/repo";

import { SeriesTable } from "./_components/SeriesTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "시리즈 관리 — 걸즈밴드 라이브",
};

export default async function AdminSeriesPage() {
  await requireAdminSession();
  const series = await listSeries();

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

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <SeriesTable series={series} />
        </CardContent>
      </Card>
    </div>
  );
}
