import { notFound } from "next/navigation";

import { getLiveById } from "@/lib/live/repo";

import { LiveEditorShell } from "./_components/LiveEditorShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "라이브 편집 — 걸즈밴드 라이브",
};

/**
 * 라이브 편집 페이지.
 *
 * - 헤더 자동저장 + 공개/비공개 토글.
 * - 다른 섹션(밴드/포맷/티어/라운드)은 다음 사이클.
 */
export default async function LiveEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const liveId = Number(id);
  if (!Number.isFinite(liveId) || liveId <= 0) {
    notFound();
  }

  const live = await getLiveById(liveId);
  if (!live) {
    notFound();
  }

  return <LiveEditorShell live={live} />;
}
