import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { getBandById } from "@/lib/band/repo";
import { coerceSnsLinks } from "@/lib/admin/sns-links";
import { listWorks } from "@/lib/works/repo";

import { BandForm } from "../../_components/BandForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "밴드 편집 — 원정가고싶다",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBandEditPage({ params }: PageProps) {
  await requireAdminSession();
  const { id } = await params;
  const bandId = Number(id);
  if (!Number.isInteger(bandId) || bandId <= 0) notFound();

  const [band, works] = await Promise.all([getBandById(bandId), listWorks()]);
  if (!band) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/admin/bands"
          className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
        >
          ← 밴드 목록
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">
          밴드 편집
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          {band.nameKo} ({band.nameJp})
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <BandForm
            mode="edit"
            bandId={band.id}
            initial={{
              workId: band.workId,
              slug: band.slug,
              nameKo: band.nameKo,
              nameJp: band.nameJp,
              nameEn: band.nameEn ?? "",
              officialUrl: band.officialUrl ?? "",
              imageUrl: band.imageUrl ?? "",
              description: band.description ?? "",
              snsLinks: coerceSnsLinks(band.snsLinks),
            }}
            works={works}
          />
        </CardContent>
      </Card>
    </div>
  );
}
