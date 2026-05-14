import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listSeries } from "@/lib/series/repo";

import { WorkForm } from "../_components/WorkForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "작품 추가 — 걸즈밴드 라이브",
};

export default async function AdminWorkNewPage() {
  await requireAdminSession();
  const series = await listSeries();

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/admin/works"
          className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
        >
          ← 작품 목록
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">
          작품 추가
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          작품(러브라이브!, 뱅드림, 걸즈밴드 크라이 등) 마스터 정보를 입력합니다.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <WorkForm mode="create" series={series} />
        </CardContent>
      </Card>
    </div>
  );
}
