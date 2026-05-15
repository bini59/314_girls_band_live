import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { requireAdminSession } from "@/lib/auth/guard";
import { listWorks } from "@/lib/works/repo";

import { BandForm } from "../_components/BandForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "밴드 추가 — 원정가고싶다",
};

export default async function AdminBandNewPage() {
  await requireAdminSession();
  const works = await listWorks();

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
          밴드 추가
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          밴드(MyGO!!!!!, 토게토게, μ&apos;s 등) 마스터 정보를 입력합니다.
        </p>
      </div>

      {works.length === 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="p-6 text-sm text-[color:var(--color-muted-foreground)]">
            먼저{" "}
            <Link href="/admin/works" className="underline">
              작품
            </Link>
            을 등록해주세요. 밴드는 작품에 속합니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <BandForm mode="create" works={works} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
