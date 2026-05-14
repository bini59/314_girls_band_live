"use client";

/**
 * 출연 밴드 추가용 콤보박스.
 *
 * - `Combobox` UI 프리미티브를 래핑하여 `searchBandsAction` 연동.
 * - 이미 추가된 bandId 는 결과에서 제외 (`excludeBandIds`).
 * - 선택 시 부모 콜백 호출 후 자체 value 를 즉시 해제 (재선택 가능 상태).
 */

import * as React from "react";

import { Combobox } from "@/components/ui/combobox";

import {
  searchBandsAction,
  type BandSearchResult,
} from "../live-band-actions";

export interface BandSearchComboboxProps {
  excludeBandIds: number[];
  onSelect: (band: BandSearchResult) => void;
  disabled?: boolean;
}

export function BandSearchCombobox({
  excludeBandIds,
  onSelect,
  disabled = false,
}: BandSearchComboboxProps): React.ReactElement {
  // Combobox 의 controlled value — 선택 직후 null 로 되돌려서
  // 같은 row 에서 연속 추가가 가능하도록 한다.
  const [value, setValue] = React.useState<BandSearchResult | null>(null);

  // excludeBandIds 는 매 렌더마다 새 배열로 올 수 있으므로 Set 으로 변환해 사용.
  const excludeSet = React.useMemo(
    () => new Set(excludeBandIds),
    [excludeBandIds]
  );

  // onSearch 는 안정적인 reference 가 좋다 (Combobox useEffect 의 의존성).
  const handleSearch = React.useCallback(
    async (query: string): Promise<BandSearchResult[]> => {
      const result = await searchBandsAction(query);
      if (!result.ok) {
        return [];
      }
      return result.bands.filter((b) => !excludeSet.has(b.id));
    },
    [excludeSet]
  );

  function handleChange(band: BandSearchResult | null): void {
    if (band) {
      onSelect(band);
      // 다음 검색을 위해 value 해제. setValue(null) 만으로 표시값이 빈 query 로 돌아간다.
      setValue(null);
    } else {
      setValue(null);
    }
  }

  return (
    <Combobox<BandSearchResult>
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      getKey={(b) => b.id}
      getLabel={(b) => b.nameKo || b.nameJp}
      getDescription={(b) =>
        b.nameJp && b.nameJp !== (b.nameKo || "") ? b.nameJp : ""
      }
      placeholder="밴드 검색 (한국어/일본어/영문/슬러그)"
      disabled={disabled}
      emptyText="검색 결과 없음"
    />
  );
}
