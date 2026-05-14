// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// 1) live-band-actions 모듈 mock — searchBandsAction 만 사용한다.
const searchBandsActionMock = vi.fn();
vi.mock("../live-band-actions", () => ({
  searchBandsAction: (q: string) => searchBandsActionMock(q),
}));

import { BandSearchCombobox } from "./BandSearchCombobox";
import type { BandSearchResult } from "../live-band-actions";

const SAMPLE: BandSearchResult[] = [
  { id: 1, nameKo: "마이고", nameJp: "MyGO!!!!!", nameEn: "MyGO!!!!!", slug: "mygo" },
  { id: 2, nameKo: "에이브뮤지카", nameJp: "アヴェ・ミュージカ", nameEn: "Ave Mujica", slug: "ave-mujica" },
  { id: 3, nameKo: "로젤리아", nameJp: "Roselia", nameEn: "Roselia", slug: "roselia" },
];

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("BandSearchCombobox", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: SAMPLE });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("디바운스(300ms) 후 searchBandsAction 호출", async () => {
    render(
      <BandSearchCombobox excludeBandIds={[]} onSelect={vi.fn()} />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);

    // 디바운스 만료 전에는 호출되지 않음.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(searchBandsActionMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await flushPromises();
    expect(searchBandsActionMock).toHaveBeenCalled();
  });

  it("excludeBandIds 에 포함된 밴드는 결과에서 제외", async () => {
    render(
      <BandSearchCombobox excludeBandIds={[1]} onSelect={vi.fn()} />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    // bandId=1 은 결과 listbox 에 나타나지 않아야 함.
    expect(screen.queryByText("마이고")).toBeNull();
    expect(screen.getByText("에이브뮤지카")).toBeDefined();
    expect(screen.getByText("로젤리아")).toBeDefined();
  });

  it("선택 시 onSelect(band) 호출 후 자체 value 초기화 (재선택 가능)", async () => {
    const onSelect = vi.fn();
    render(
      <BandSearchCombobox excludeBandIds={[]} onSelect={onSelect} />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    // 첫 번째 옵션을 마우스다운으로 선택.
    fireEvent.mouseDown(screen.getByText("마이고"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: 1, nameKo: "마이고" });

    // value 가 초기화되어 input 표시값이 빈 상태 (placeholder 가 보임).
    // controlled value=null 이므로 displayValue 는 빈 query → ""
    expect(input.value).toBe("");
  });

  it("searchBandsAction 이 ok=false 면 빈 결과로 처리", async () => {
    searchBandsActionMock.mockResolvedValue({ ok: false, error: "검색 실패" });
    render(
      <BandSearchCombobox excludeBandIds={[]} onSelect={vi.fn()} />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.getByText("검색 결과 없음")).toBeDefined();
  });

  it("disabled 시 input 비활성", () => {
    render(
      <BandSearchCombobox excludeBandIds={[]} onSelect={vi.fn()} disabled />
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
