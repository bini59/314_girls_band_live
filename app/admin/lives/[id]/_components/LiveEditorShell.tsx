import Link from "next/link";
import type { Live } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

import { LiveHeaderSection } from "./LiveHeaderSection";
import { PublishGate } from "./PublishGate";
import { SectionPlaceholder } from "./SectionPlaceholder";

/**
 * 라이브 편집기 셸.
 *
 * - 상단: 제목 + slug + 상태 배지 + 뒤로가기
 * - 본문: 헤더 섹션(자동저장) + 다음 사이클 섹션 placeholder
 * - 우측: 공개 게이트 (lg 이상)
 */
export function LiveEditorShell({ live }: { live: Live }) {
  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-2">
        <Link
          href="/admin/lives"
          className="text-xs text-[color:var(--color-muted-foreground)] hover:underline"
        >
          ← 목록으로
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{live.titleKo}</h1>
          <Badge
            variant={live.status === "PUBLISHED" ? "success" : "secondary"}
          >
            {live.status}
          </Badge>
        </div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          /lives/{live.slug}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-6">
          <LiveHeaderSection live={live} />
          <SectionPlaceholder
            title="출연 밴드"
            description="LiveBand 관리 — 검색 후 추가, 헤드라이너, 순서"
          />
          <SectionPlaceholder
            title="포맷"
            description="실황 / 라이브뷰잉 / 배포"
          />
          <SectionPlaceholder
            title="티어"
            description="포맷별 좌석 등급과 가격"
          />
          <SectionPlaceholder
            title="판매 라운드"
            description="선행 / 일반 / 추첨 / 선착 라운드와 발매처"
          />
        </div>

        <PublishGate live={live} />
      </div>
    </div>
  );
}
