"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Live } from "@prisma/client";

import { Button } from "@/components/ui/button";

import {
  publishLiveAction,
  unpublishLiveAction,
} from "../actions";

/**
 * 공개/비공개 게이트.
 *
 * - DRAFT: "공개" 버튼. 헤더 게이트 실패 시 부족 항목 표시.
 * - PUBLISHED: "비공개로 전환" 버튼.
 *
 * 본 사이클 한정: LiveBand >= 1 검증 미적용. (다음 사이클에서 활성화)
 */
const FIELD_LABEL: Record<string, string> = {
  titleKo: "제목 (KO)",
  titleJp: "제목 (JP)",
  type: "타입",
  startAt: "개연 시간",
  venueName: "장소",
  liveBand: "출연 밴드",
};

export function PublishGate({ live }: { live: Live }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gateFailures, setGateFailures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handlePublish() {
    setError(null);
    setGateFailures([]);
    startTransition(async () => {
      const result = await publishLiveAction(live.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.gateFailures && result.gateFailures.length > 0) {
        setGateFailures(result.gateFailures);
      } else if (result.error) {
        setError(result.error);
      } else {
        setError("공개에 실패했습니다.");
      }
    });
  }

  function handleUnpublish() {
    setError(null);
    setGateFailures([]);
    startTransition(async () => {
      const result = await unpublishLiveAction(live.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error ?? "비공개 전환에 실패했습니다.");
    });
  }

  return (
    <aside className="flex w-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 p-4 lg:w-72">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
        공개 상태
      </h3>

      <p className="text-sm text-[color:var(--color-muted-foreground)]">
        현재 {live.status === "PUBLISHED" ? "공개" : "비공개"} 상태입니다.
      </p>

      {live.status === "PUBLISHED" ? (
        <Button
          variant="outline"
          onClick={handleUnpublish}
          disabled={pending}
        >
          {pending ? "전환 중..." : "비공개로 전환"}
        </Button>
      ) : (
        <Button onClick={handlePublish} disabled={pending}>
          {pending ? "공개 중..." : "공개"}
        </Button>
      )}

      {gateFailures.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 p-3 text-xs text-[color:var(--color-destructive)]">
          <p className="font-semibold">부족한 항목:</p>
          <ul className="mt-1 list-disc pl-4">
            {gateFailures.map((f) => (
              <li key={f}>{FIELD_LABEL[f] ?? f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}
    </aside>
  );
}
