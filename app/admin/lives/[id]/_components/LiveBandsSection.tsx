"use client";

/**
 * LiveBandsSection — 출연 밴드 섹션 (낙관적 UI).
 *
 * 책임:
 *  - useSectionList 로 라인업 상태 관리 (add/remove/replace/reorder).
 *  - 모든 mutation:
 *      1. 낙관적 업데이트
 *      2. Server Action 호출
 *      3. 실패 시 직전 snapshot 으로 rollback + 에러 메시지 노출
 *  - in-flight 중복 클릭 차단 — `inFlightRef` (Set of bandId).
 *
 * 비고: drag-and-drop 은 본 사이클 범위 밖. ↑↓ 버튼으로 순서를 바꾼다.
 */

import * as React from "react";

import { useSectionList } from "@/lib/admin/section-state";

import { SectionCard } from "./SectionCard";
import { BandSearchCombobox } from "./BandSearchCombobox";
import { LiveBandRow } from "./LiveBandRow";

import {
  addLiveBandAction,
  removeLiveBandAction,
  reorderLiveBandsAction,
  updateLiveBandAction,
  type BandSearchResult,
} from "../live-band-actions";

export interface LiveBandsSectionItem {
  bandId: number;
  isHeadliner: boolean;
  order: number;
  band: {
    nameKo: string;
    nameJp: string;
  };
}

export interface LiveBandsSectionProps {
  liveId: number;
  initialBands: LiveBandsSectionItem[];
}

const REMOVE_KEY = (bandId: number) => `remove:${bandId}`;
const UPDATE_KEY = (bandId: number) => `update:${bandId}`;
const MOVE_KEY = (bandId: number) => `move:${bandId}`;
const ADD_KEY = (bandId: number) => `add:${bandId}`;

export function LiveBandsSection({
  liveId,
  initialBands,
}: LiveBandsSectionProps): React.ReactElement {
  // 초기 정렬을 보장 (order asc, bandId asc).
  const sortedInitial = React.useMemo(
    () => sortByOrder(initialBands),
    [initialBands]
  );

  const list = useSectionList<LiveBandsSectionItem>(
    sortedInitial,
    (item) => item.bandId
  );

  // in-flight 중복 차단용 set — bandId 또는 작업 키.
  const inFlightRef = React.useRef<Set<string>>(new Set());

  const [error, setError] = React.useState<string | null>(null);

  function pushError(message: string): void {
    setError(message);
  }

  function clearError(): void {
    setError(null);
  }

  function snapshot(): LiveBandsSectionItem[] {
    // 불변 — 현재 state 의 얕은 복사본.
    return [...list.items];
  }

  // ===== add =====

  async function handleAdd(band: BandSearchResult): Promise<void> {
    const key = ADD_KEY(band.id);
    if (inFlightRef.current.has(key)) {
      return;
    }
    inFlightRef.current.add(key);

    const before = snapshot();
    // 이미 존재하면 (race) 거부.
    if (before.some((b) => b.bandId === band.id)) {
      inFlightRef.current.delete(key);
      return;
    }

    const optimistic: LiveBandsSectionItem = {
      bandId: band.id,
      isHeadliner: false,
      order: before.length,
      band: { nameKo: band.nameKo, nameJp: band.nameJp },
    };
    list.add(optimistic);

    try {
      const result = await addLiveBandAction(liveId, band.id);
      if (!result.ok) {
        list.reset(before);
        pushError(result.error ?? "출연 밴드 추가에 실패했습니다.");
      } else {
        clearError();
      }
    } catch (err) {
      console.error("[LiveBandsSection.handleAdd]", err);
      list.reset(before);
      pushError("출연 밴드 추가 중 오류가 발생했습니다.");
    } finally {
      inFlightRef.current.delete(key);
    }
  }

  // ===== remove =====

  async function handleRemove(bandId: number): Promise<void> {
    const key = REMOVE_KEY(bandId);
    if (inFlightRef.current.has(key)) {
      return;
    }
    inFlightRef.current.add(key);

    const before = snapshot();
    list.remove(bandId);

    try {
      const result = await removeLiveBandAction(liveId, bandId);
      if (!result.ok) {
        list.reset(before);
        pushError(result.error ?? "출연 밴드 제거에 실패했습니다.");
      } else {
        clearError();
      }
    } catch (err) {
      console.error("[LiveBandsSection.handleRemove]", err);
      list.reset(before);
      pushError("출연 밴드 제거 중 오류가 발생했습니다.");
    } finally {
      inFlightRef.current.delete(key);
    }
  }

  // ===== headliner / order update =====

  async function handleUpdate(
    bandId: number,
    patch: { isHeadliner?: boolean }
  ): Promise<void> {
    const key = UPDATE_KEY(bandId);
    if (inFlightRef.current.has(key)) {
      return;
    }
    inFlightRef.current.add(key);

    const before = snapshot();
    const target = before.find((b) => b.bandId === bandId);
    if (!target) {
      inFlightRef.current.delete(key);
      return;
    }
    const next: LiveBandsSectionItem = {
      ...target,
      ...(patch.isHeadliner !== undefined
        ? { isHeadliner: patch.isHeadliner }
        : {}),
    };
    list.replace(bandId, next);

    try {
      const result = await updateLiveBandAction(liveId, bandId, patch);
      if (!result.ok) {
        list.reset(before);
        pushError(result.error ?? "출연 밴드 업데이트에 실패했습니다.");
      } else {
        clearError();
      }
    } catch (err) {
      console.error("[LiveBandsSection.handleUpdate]", err);
      list.reset(before);
      pushError("출연 밴드 업데이트 중 오류가 발생했습니다.");
    } finally {
      inFlightRef.current.delete(key);
    }
  }

  // ===== reorder (↑↓ 버튼) =====

  async function handleMove(
    bandId: number,
    direction: "up" | "down"
  ): Promise<void> {
    const key = MOVE_KEY(bandId);
    if (inFlightRef.current.has(key)) {
      return;
    }
    inFlightRef.current.add(key);

    const before = snapshot();
    const idx = before.findIndex((b) => b.bandId === bandId);
    if (idx < 0) {
      inFlightRef.current.delete(key);
      return;
    }
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= before.length) {
      inFlightRef.current.delete(key);
      return;
    }

    // immutable swap.
    const next = before.slice();
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    const orderedIds = next.map((b) => b.bandId);
    list.reorder(orderedIds);

    try {
      const result = await reorderLiveBandsAction(liveId, orderedIds);
      if (!result.ok) {
        list.reset(before);
        pushError(result.error ?? "출연 밴드 순서 변경에 실패했습니다.");
      } else {
        clearError();
      }
    } catch (err) {
      console.error("[LiveBandsSection.handleMove]", err);
      list.reset(before);
      pushError("출연 밴드 순서 변경 중 오류가 발생했습니다.");
    } finally {
      inFlightRef.current.delete(key);
    }
  }

  // ===== render =====

  const excludeIds = list.items.map((b) => b.bandId);
  const total = list.items.length;
  const tone: "default" | "warning" = total === 0 ? "warning" : "default";

  return (
    <SectionCard
      title="출연 밴드"
      description="Live 에 출연하는 밴드를 추가/순서 변경하세요. 최소 1개 이상 공개 가능."
      tone={tone}
      action={
        <div className="w-72">
          <BandSearchCombobox
            excludeBandIds={excludeIds}
            onSelect={(b) => {
              void handleAdd(b);
            }}
          />
        </div>
      }
    >
      {total === 0 ? (
        <p
          data-testid="live-bands-empty"
          className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted-foreground)]"
        >
          출연 밴드를 추가하세요. 공개에는 1개 이상 필요합니다.
        </p>
      ) : (
        <ul
          data-testid="live-bands-list"
          className="flex flex-col gap-2"
        >
          {list.items.map((lb, index) => (
            <LiveBandRow
              key={lb.bandId}
              liveBand={lb}
              index={index}
              total={total}
              onUpdate={(patch) => handleUpdate(lb.bandId, patch)}
              onMoveUp={() => handleMove(lb.bandId, "up")}
              onMoveDown={() => handleMove(lb.bandId, "down")}
              onRemove={() => handleRemove(lb.bandId)}
            />
          ))}
        </ul>
      )}

      {error ? (
        <div
          role="alert"
          data-testid="live-bands-error"
          className="mt-3 flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 px-3 py-2 text-sm text-[color:var(--color-destructive)]"
        >
          <span>{error}</span>
          <button
            type="button"
            aria-label="에러 닫기"
            onClick={clearError}
            className="shrink-0 px-1 text-xs hover:underline"
          >
            닫기
          </button>
        </div>
      ) : null}
    </SectionCard>
  );
}

function sortByOrder(items: LiveBandsSectionItem[]): LiveBandsSectionItem[] {
  return [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.bandId - b.bandId;
  });
}
