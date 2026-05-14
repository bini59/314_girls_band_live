"use client";

/**
 * LiveBandRow — 출연 밴드 1건 row.
 *
 * 표시 요소:
 *  - drag handle (현재는 시각적 표시만, 키보드/드래그 동작은 ↑↓ 버튼으로 대체)
 *  - 밴드명 (nameKo + nameJp 보조)
 *  - 헤드라이너 체크박스
 *  - 위로/아래로 이동 버튼 (가장자리에서는 disabled)
 *  - 제거 버튼
 *
 * 비즈니스 로직 없음 — 모든 mutation 은 부모(LiveBandsSection) 에 위임.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface LiveBandRowProps {
  liveBand: {
    bandId: number;
    isHeadliner: boolean;
    order: number;
    band: {
      nameKo: string;
      nameJp: string;
    };
  };
  index: number;
  total: number;
  onUpdate: (patch: { isHeadliner?: boolean }) => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}

export function LiveBandRow({
  liveBand,
  index,
  total,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled = false,
}: LiveBandRowProps): React.ReactElement {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const headlinerId = `live-band-headliner-${liveBand.bandId}`;

  return (
    <li
      data-band-id={liveBand.bandId}
      data-testid={`live-band-row-${liveBand.bandId}`}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-3"
    >
      {/* drag handle — 시각적 표시만 (실제 동작은 ↑↓ 버튼) */}
      <span
        aria-hidden="true"
        className="cursor-grab select-none text-[color:var(--color-muted-foreground)]"
        title="순서 변경"
      >
        ⋮⋮
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[color:var(--color-foreground)]">
          {liveBand.band.nameKo || liveBand.band.nameJp}
        </div>
        {liveBand.band.nameJp &&
        liveBand.band.nameJp !== liveBand.band.nameKo ? (
          <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">
            {liveBand.band.nameJp}
          </div>
        ) : null}
      </div>

      <label
        htmlFor={headlinerId}
        className="flex shrink-0 items-center gap-2 text-xs text-[color:var(--color-foreground)]"
      >
        <Checkbox
          id={headlinerId}
          checked={liveBand.isHeadliner}
          disabled={disabled}
          onChange={(e) => {
            void onUpdate({ isHeadliner: e.currentTarget.checked });
          }}
        />
        헤드라이너
      </label>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="위로 이동"
          disabled={disabled || isFirst}
          onClick={() => {
            void onMoveUp();
          }}
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="아래로 이동"
          disabled={disabled || isLast}
          onClick={() => {
            void onMoveDown();
          }}
        >
          ↓
        </Button>
      </div>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={disabled}
        onClick={() => {
          void onRemove();
        }}
      >
        제거
      </Button>
    </li>
  );
}
