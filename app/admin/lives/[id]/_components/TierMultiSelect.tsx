"use client";

/**
 * TierMultiSelect — 포맷별로 그룹화된 티어 체크박스 그리드.
 *
 * - 입력: formats[].tiers[] (포맷별 묶음).
 * - 선택은 평탄한 tierId 배열 (`selectedTierIds`) 로 표현 / 콜백.
 * - 한 라운드가 여러 포맷에 걸쳐 티어를 묶는 케이스를 허용.
 * - 비어있으면 안내 메시지 + 전체 disabled.
 *
 * 컨벤션:
 *  - 시각/금액 표기는 JST/JPY (UX_DECISIONS).
 *  - 한국어 라벨 (formatType: 현지 공연 / 라이브 뷰잉 / 배포).
 */
import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { LiveFormatType } from "@prisma/client";

import {
  LIVE_FORMAT_TYPE_LABELS,
  formatJpy,
} from "./ticket-sale-labels";

export type TierMultiSelectFormat = {
  id: number;
  type: LiveFormatType;
  label?: string | null;
  venueName?: string | null;
  tiers: Array<{ id: number; name: string; priceJpy: number }>;
};

export interface TierMultiSelectProps {
  formats: TierMultiSelectFormat[];
  selectedTierIds: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}

export function TierMultiSelect({
  formats,
  selectedTierIds,
  onChange,
  disabled = false,
}: TierMultiSelectProps): React.JSX.Element {
  const selectedSet = useMemo(
    () => new Set<number>(selectedTierIds),
    [selectedTierIds]
  );

  // 모든 포맷에 티어가 하나도 없으면 빈 상태로 안내.
  const totalTierCount = formats.reduce((acc, f) => acc + f.tiers.length, 0);
  if (formats.length === 0 || totalTierCount === 0) {
    return (
      <div
        data-testid="tier-multi-select-empty"
        className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted)]/30 p-4 text-sm text-[color:var(--color-muted-foreground)]"
      >
        먼저 포맷과 티어를 등록해주세요.
      </div>
    );
  }

  function toggle(tierId: number, checked: boolean): void {
    if (disabled) return;
    if (checked) {
      if (selectedSet.has(tierId)) return;
      onChange([...selectedTierIds, tierId]);
    } else {
      onChange(selectedTierIds.filter((id) => id !== tierId));
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="tier-multi-select">
      {formats.map((fmt) => {
        const head =
          [LIVE_FORMAT_TYPE_LABELS[fmt.type], fmt.label, fmt.venueName]
            .filter((v): v is string => !!v && v.length > 0)
            .join(" · ") || LIVE_FORMAT_TYPE_LABELS[fmt.type];

        return (
          <fieldset
            key={fmt.id}
            data-testid={`tier-group-${fmt.id}`}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3"
            disabled={disabled}
          >
            <legend className="px-1 text-xs font-medium text-[color:var(--color-muted-foreground)]">
              {head}
            </legend>
            {fmt.tiers.length === 0 ? (
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                등록된 티어가 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {fmt.tiers.map((tier) => {
                  const inputId = `tier-${tier.id}`;
                  const checked = selectedSet.has(tier.id);
                  return (
                    <label
                      key={tier.id}
                      htmlFor={inputId}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 hover:bg-[color:var(--color-muted)]"
                    >
                      <Checkbox
                        id={inputId}
                        name="tierIds"
                        value={tier.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => toggle(tier.id, e.target.checked)}
                      />
                      <span className="text-sm">
                        {tier.name}{" "}
                        <span className="text-[color:var(--color-muted-foreground)]">
                          {formatJpy(tier.priceJpy)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
