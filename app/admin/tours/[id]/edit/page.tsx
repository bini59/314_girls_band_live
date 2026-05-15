import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listWorks } from "@/lib/works/repo";
import { getTourById } from "@/lib/tours/repo";
import { utcToJstLocal } from "@/lib/admin/jst-datetime";

import { TourForm } from "../../_components/TourForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "투어 편집 — 원정가고싶다",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTourEditPage({ params }: PageProps) {
  await requireAdminSession();
  const { id } = await params;
  const tourId = Number(id);
  if (!Number.isInteger(tourId) || tourId <= 0) notFound();

  const [tour, works] = await Promise.all([
    getTourById(tourId),
    listWorks(),
  ]);
  if (!tour) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/admin/tours"
          className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
        >
          ← 투어 목록
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">
          투어 편집
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          {tour.nameKo} ({tour.nameJp})
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <TourForm
            mode="edit"
            tourId={tour.id}
            initial={{
              workId: tour.workId,
              slug: tour.slug,
              nameKo: tour.nameKo,
              nameJp: tour.nameJp,
              nameEn: tour.nameEn ?? "",
              description: tour.description ?? "",
              posterUrl: tour.posterUrl ?? "",
              thumbnailUrl: tour.thumbnailUrl ?? "",
              officialUrl: tour.officialUrl ?? "",
              startsAtJst: tour.startsAt ? utcToJstLocal(tour.startsAt) : "",
              endsAtJst: tour.endsAt ? utcToJstLocal(tour.endsAt) : "",
              status: tour.status,
            }}
            works={works}
          />
        </CardContent>
      </Card>
    </div>
  );
}
