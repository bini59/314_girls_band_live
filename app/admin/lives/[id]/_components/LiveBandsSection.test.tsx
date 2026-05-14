// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// 1) live-band-actions 모듈 mock — 각 action 별로 controlled mock 사용.
const addLiveBandActionMock = vi.fn();
const removeLiveBandActionMock = vi.fn();
const updateLiveBandActionMock = vi.fn();
const reorderLiveBandsActionMock = vi.fn();
const searchBandsActionMock = vi.fn();

vi.mock("../live-band-actions", () => ({
  addLiveBandAction: (...args: unknown[]) => addLiveBandActionMock(...args),
  removeLiveBandAction: (...args: unknown[]) =>
    removeLiveBandActionMock(...args),
  updateLiveBandAction: (...args: unknown[]) =>
    updateLiveBandActionMock(...args),
  reorderLiveBandsAction: (...args: unknown[]) =>
    reorderLiveBandsActionMock(...args),
  searchBandsAction: (...args: unknown[]) => searchBandsActionMock(...args),
}));

import { LiveBandsSection } from "./LiveBandsSection";
import type { LiveBandsSectionItem } from "./LiveBandsSection";

const LIVE_ID = 42;

function band(
  id: number,
  order: number,
  nameKo = `밴드${id}`,
  isHeadliner = false
): LiveBandsSectionItem {
  return {
    bandId: id,
    isHeadliner,
    order,
    band: { nameKo, nameJp: `BAND-${id}` },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("LiveBandsSection — 렌더링", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: [] });
  });

  it("initialBands 가 비면 empty state 메시지 표시", () => {
    render(<LiveBandsSection liveId={LIVE_ID} initialBands={[]} />);
    expect(screen.getByTestId("live-bands-empty")).toBeDefined();
    expect(screen.queryByTestId("live-bands-list")).toBeNull();
  });

  it("initialBands 가 order 순으로 렌더링", () => {
    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[
          band(1, 2, "C"),
          band(2, 0, "A"),
          band(3, 1, "B"),
        ]}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("A");
    expect(items[1].textContent).toContain("B");
    expect(items[2].textContent).toContain("C");
  });
});

describe("LiveBandsSection — add (optimistic + rollback)", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({
      ok: true,
      bands: [
        { id: 100, nameKo: "신규밴드", nameJp: "NEW", nameEn: "NEW", slug: "new" },
      ],
    });
  });

  async function selectFromCombobox(): Promise<void> {
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    // Combobox 내부 디바운스 (300ms) 후에 결과가 채워진다 — fake timers 없이 promise 대기.
    await flush();
    await flush();
    // 다음 microtask 까지 충분히 flush — useEffect 의 setTimeout(300ms) 은
    // 실제 타이머이므로 act 로 진행시킨다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    fireEvent.mouseDown(screen.getByText("신규밴드"));
  }

  it("add 성공 시 리스트에 즉시 표시 + action 호출", async () => {
    addLiveBandActionMock.mockResolvedValue({ ok: true });

    render(<LiveBandsSection liveId={LIVE_ID} initialBands={[]} />);
    await selectFromCombobox();
    await flush();

    expect(addLiveBandActionMock).toHaveBeenCalledWith(LIVE_ID, 100);
    // 새 밴드가 렌더링됨.
    expect(screen.queryByText("신규밴드")).not.toBeNull();
  });

  it("add 실패 시 rollback + 에러 메시지 표시", async () => {
    addLiveBandActionMock.mockResolvedValue({
      ok: false,
      error: "테스트 실패",
    });

    render(<LiveBandsSection liveId={LIVE_ID} initialBands={[]} />);
    await selectFromCombobox();
    await flush();

    // 롤백 — empty state 로 복원.
    expect(screen.getByTestId("live-bands-empty")).toBeDefined();
    expect(screen.getByTestId("live-bands-error").textContent).toContain(
      "테스트 실패"
    );
  });
});

describe("LiveBandsSection — remove (optimistic + rollback)", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: [] });
  });

  it("remove 성공 시 리스트에서 즉시 제거", async () => {
    removeLiveBandActionMock.mockResolvedValue({ ok: true });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X")]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    await flush();

    expect(removeLiveBandActionMock).toHaveBeenCalledWith(LIVE_ID, 1);
    expect(screen.getByTestId("live-bands-empty")).toBeDefined();
  });

  it("remove 실패 시 rollback + 에러 표시", async () => {
    removeLiveBandActionMock.mockResolvedValue({
      ok: false,
      error: "제거 실패",
    });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X")]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    await flush();

    // 롤백 — 항목이 다시 보임.
    expect(screen.queryByText("X")).not.toBeNull();
    expect(screen.getByTestId("live-bands-error").textContent).toContain(
      "제거 실패"
    );
  });

  it("동일 row 빠른 더블 클릭 시 action 은 1회만 호출 (race guard)", async () => {
    // 첫 호출은 pending 상태로 유지하여 두 번째 클릭이 in-flight 중 들어오게 한다.
    let resolveFirst: (value: { ok: true }) => void = () => {};
    removeLiveBandActionMock.mockImplementationOnce(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveFirst = resolve;
        })
    );

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X")]}
      />
    );

    const removeBtn = screen.getByRole("button", { name: "제거" });
    fireEvent.click(removeBtn);
    // 1차 클릭으로 row 가 사라졌을 수 있으므로 다시 query.
    // optimistic remove 로 버튼이 사라지면 두번째 클릭이 불가능. → 첫 클릭 전에 즉시 추가 클릭.
    fireEvent.click(removeBtn);
    fireEvent.click(removeBtn);

    expect(removeLiveBandActionMock).toHaveBeenCalledTimes(1);

    // resolve 하여 cleanup.
    resolveFirst({ ok: true });
    await flush();
  });
});

describe("LiveBandsSection — headliner update", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: [] });
  });

  it("체크박스 클릭 → 낙관적 update + action 호출", async () => {
    updateLiveBandActionMock.mockResolvedValue({ ok: true });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X", false)]}
      />
    );
    const cb = screen.getByLabelText("헤드라이너") as HTMLInputElement;
    expect(cb.checked).toBe(false);

    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    await flush();

    expect(updateLiveBandActionMock).toHaveBeenCalledWith(LIVE_ID, 1, {
      isHeadliner: true,
    });
  });

  it("update 실패 시 rollback (체크박스 되돌림)", async () => {
    updateLiveBandActionMock.mockResolvedValue({
      ok: false,
      error: "업데이트 실패",
    });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X", false)]}
      />
    );
    const cb = screen.getByLabelText("헤드라이너") as HTMLInputElement;
    fireEvent.click(cb);
    await flush();

    expect(cb.checked).toBe(false);
    expect(screen.getByTestId("live-bands-error").textContent).toContain(
      "업데이트 실패"
    );
  });
});

describe("LiveBandsSection — reorder (↑↓)", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: [] });
  });

  it("두 번째 row 의 위로이동 → reorder 호출 (순서 swap)", async () => {
    reorderLiveBandsActionMock.mockResolvedValue({ ok: true });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "A"), band(2, 1, "B"), band(3, 2, "C")]}
      />
    );

    // B (index=1) 의 위로 이동 버튼.
    const upButtons = screen.getAllByRole("button", { name: "위로 이동" });
    // upButtons[0] 은 A (index=0) 의 버튼이며 disabled. B 의 버튼은 index 1.
    fireEvent.click(upButtons[1]);
    await flush();

    expect(reorderLiveBandsActionMock).toHaveBeenCalledWith(
      LIVE_ID,
      [2, 1, 3]
    );

    // 시각적 순서도 B, A, C 로 갱신.
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("B");
    expect(items[1].textContent).toContain("A");
    expect(items[2].textContent).toContain("C");
  });

  it("첫번째 row 의 아래로이동 → reorder 호출", async () => {
    reorderLiveBandsActionMock.mockResolvedValue({ ok: true });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "A"), band(2, 1, "B")]}
      />
    );

    const downButtons = screen.getAllByRole("button", { name: "아래로 이동" });
    fireEvent.click(downButtons[0]);
    await flush();

    expect(reorderLiveBandsActionMock).toHaveBeenCalledWith(LIVE_ID, [2, 1]);
  });

  it("reorder 실패 시 rollback", async () => {
    reorderLiveBandsActionMock.mockResolvedValue({
      ok: false,
      error: "정렬 실패",
    });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "A"), band(2, 1, "B")]}
      />
    );

    const downButtons = screen.getAllByRole("button", { name: "아래로 이동" });
    fireEvent.click(downButtons[0]);
    await flush();

    // 롤백 — 원래 순서 A, B 로 복원.
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("A");
    expect(items[1].textContent).toContain("B");
    expect(screen.getByTestId("live-bands-error").textContent).toContain(
      "정렬 실패"
    );
  });
});

describe("LiveBandsSection — 에러 배너 닫기", () => {
  beforeEach(() => {
    addLiveBandActionMock.mockReset();
    removeLiveBandActionMock.mockReset();
    updateLiveBandActionMock.mockReset();
    reorderLiveBandsActionMock.mockReset();
    searchBandsActionMock.mockReset();
    searchBandsActionMock.mockResolvedValue({ ok: true, bands: [] });
  });

  it("닫기 버튼 누르면 에러 사라짐", async () => {
    removeLiveBandActionMock.mockResolvedValue({
      ok: false,
      error: "제거 실패",
    });

    render(
      <LiveBandsSection
        liveId={LIVE_ID}
        initialBands={[band(1, 0, "X")]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    await flush();

    expect(screen.getByTestId("live-bands-error")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "에러 닫기" }));
    expect(screen.queryByTestId("live-bands-error")).toBeNull();
  });
});
