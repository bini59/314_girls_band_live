import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listWorks } from "@/lib/works/repo";

import { TourForm } from "../_components/TourForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "투어 추가 — 걸즈밴드 라이브",
};

export default async function AdminTourNewPage() {
  await requireAdminSession();
  const works = await listWorks();

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
          투어 추가
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          투어(예: 결속밴드 We will B, 학마스 LIVE TOUR 標) 마스터 정보를 입력합니다.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <TourForm mode="create" works={works} />
        </CardContent>
      </Card>
    </div>
  );
}
