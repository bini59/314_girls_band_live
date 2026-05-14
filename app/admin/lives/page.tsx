import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

import { listLivesForAdmin } from "@/lib/live/repo";

import { LivesTable } from "./_components/LivesTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "라이브 관리 — 걸즈밴드 라이브",
};

/**
 * 어드민 라이브 목록.
 *
 * - 본 사이클: 최근 작업한 라이브 50건만 (정렬/필터/검색 X — 다음 사이클).
 * - 빈 상태 안내 + "+ 새 라이브" 진입점.
 */
export default async function AdminLivesPage() {
  const lives = await listLivesForAdmin();

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
            라이브 관리
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            등록된 라이브를 관리하고 새 공연을 추가합니다.
          </p>
        </div>
        <Link
          href="/admin/lives/new"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] hover:opacity-90"
        >
          + 새 라이브
        </Link>
      </div>

      {lives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-base text-[color:var(--color-muted-foreground)]">
              아직 라이브가 없습니다.
            </p>
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              상단의 버튼으로 첫 라이브를 등록해보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <LivesTable lives={lives} />
        </Card>
      )}

      {/* TODO(cycle-C): 정렬/필터/검색/페이지네이션 UI 추가 */}
    </div>
  );
}
