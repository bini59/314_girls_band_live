// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { TierMultiSelect, type TierMultiSelectFormat } from "./TierMultiSelect";

const FORMATS: TierMultiSelectFormat[] = [
  {
    id: 1,
    type: "LIVE_VENUE",
    label: null,
    venueName: "Saitama Super Arena",
    tiers: [
      { id: 11, name: "S석", priceJpy: 9800 },
      { id: 12, name: "스탠딩", priceJpy: 7800 },
    ],
  },
  {
    id: 2,
    type: "LIVE_VIEWING",
    label: "본인 LV",
    venueName: null,
    tiers: [{ id: 21, name: "일반", priceJpy: 4500 }],
  },
];

describe("TierMultiSelect", () => {
  it("formats 별로 그룹 헤딩과 체크박스를 렌더링한다", () => {
    render(
      <TierMultiSelect
        formats={FORMATS}
        selectedTierIds={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId("tier-group-1")).toBeDefined();
    expect(screen.getByTestId("tier-group-2")).toBeDefined();

    // 그룹 헤딩에 라벨/포맷이 포함된다.
    expect(screen.getByText(/현지 공연/)).toBeDefined();
    expect(screen.getByText(/라이브 뷰잉/)).toBeDefined();
    expect(screen.getByText(/Saitama Super Arena/)).toBeDefined();
    expect(screen.getByText(/본인 LV/)).toBeDefined();

    // tier 항목 표시 (이름 + ¥가격).
    expect(screen.getByText(/S석/)).toBeDefined();
    expect(screen.getByText(/¥9,800/)).toBeDefined();
    expect(screen.getByText(/스탠딩/)).toBeDefined();
    expect(screen.getByText(/¥7,800/)).toBeDefined();
  });

  it("체크박스 토글이 onChange 를 평탄한 tierIds 배열로 호출한다", () => {
    const onChange = vi.fn();
    render(
      <TierMultiSelect
        formats={FORMATS}
        selectedTierIds={[]}
        onChange={onChange}
      />
    );
    const cb11 = screen.getByLabelText(/S석/) as HTMLInputElement;
    fireEvent.click(cb11);
    expect(onChange).toHaveBeenCalledWith([11]);
  });

  it("이미 선택된 항목 해제 → onChange 가 그 id 를 뺀 배열로 호출", () => {
    const onChange = vi.fn();
    render(
      <TierMultiSelect
        formats={FORMATS}
        selectedTierIds={[11, 21]}
        onChange={onChange}
      />
    );
    const cb11 = screen.getByLabelText(/S석/) as HTMLInputElement;
    expect(cb11.checked).toBe(true);
    fireEvent.click(cb11);
    expect(onChange).toHaveBeenCalledWith([21]);
  });

  it("disabled 인 경우 모든 체크박스가 비활성화 + onChange 미호출", () => {
    const onChange = vi.fn();
    render(
      <TierMultiSelect
        formats={FORMATS}
        selectedTierIds={[]}
        onChange={onChange}
        disabled
      />
    );
    const cb11 = screen.getByLabelText(/S석/) as HTMLInputElement;
    expect(cb11.disabled).toBe(true);
    fireEvent.click(cb11);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("포맷이 비어있으면 안내 메시지 표시", () => {
    render(
      <TierMultiSelect
        formats={[]}
        selectedTierIds={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId("tier-multi-select-empty")).toBeDefined();
    expect(screen.getByText(/먼저 포맷과 티어를 등록해주세요/)).toBeDefined();
  });

  it("포맷은 있지만 어떤 포맷에도 티어가 없으면 빈 상태", () => {
    render(
      <TierMultiSelect
        formats={[{ id: 1, type: "LIVE_VENUE", tiers: [] }]}
        selectedTierIds={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId("tier-multi-select-empty")).toBeDefined();
  });

  it("한 포맷만 비어있고 다른 포맷에는 티어 있으면 빈 상태가 아님", () => {
    render(
      <TierMultiSelect
        formats={[
          { id: 1, type: "LIVE_VENUE", tiers: [] },
          {
            id: 2,
            type: "STREAMING",
            tiers: [{ id: 22, name: "배포", priceJpy: 3000 }],
          },
        ]}
        selectedTierIds={[]}
        onChange={() => {}}
      />
    );
    expect(screen.queryByTestId("tier-multi-select-empty")).toBeNull();
    const group1 = screen.getByTestId("tier-group-1");
    expect(within(group1).getByText(/등록된 티어가 없습니다/)).toBeDefined();
  });
});
