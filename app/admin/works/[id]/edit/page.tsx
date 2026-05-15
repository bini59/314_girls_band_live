import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listSeries } from "@/lib/series/repo";
import { getWorkById } from "@/lib/works/repo";

import { WorkForm } from "../../_components/WorkForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "작품 편집 — 원정가고싶다",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminWorkEditPage({ params }: PageProps) {
  await requireAdminSession();
  const { id } = await params;
  const workId = Number(id);
  if (!Number.isInteger(workId) || workId <= 0) notFound();

  const [work, series] = await Promise.all([
    getWorkById(workId),
    listSeries(),
  ]);
  if (!work) notFound();

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
          작품 편집
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          {work.nameKo} ({work.nameJp})
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <WorkForm
            mode="edit"
            workId={work.id}
            initial={{
              slug: work.slug,
              nameKo: work.nameKo,
              nameJp: work.nameJp,
              nameEn: work.nameEn ?? "",
              kind: work.kind ?? "",
              logoUrl: work.logoUrl ?? "",
              description: work.description ?? "",
              seriesId: work.seriesId ?? null,
            }}
            series={series}
          />
        </CardContent>
      </Card>
    </div>
  );
}
