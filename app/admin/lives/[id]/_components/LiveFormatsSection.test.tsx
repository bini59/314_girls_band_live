// @vitest-environment jsdom
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

// Server Action 모듈 mock — 컴포넌트가 import 하는 경로와 동일하게 hoist.
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../live-format-actions", () => ({
  createLiveFormatAction: (...args: unknown[]) => createMock(...args),
  updateLiveFormatAction: (...args: unknown[]) => updateMock(...args),
  deleteLiveFormatAction: (...args: unknown[]) => deleteMock(...args),
}));

import { LiveFormatsSection } from "./LiveFormatsSection";

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("LiveFormatsSection", () => {
  it("renders empty state when no formats", () => {
    render(<LiveFormatsSection liveId={1} initialFormats={[]} />);
    expect(
      screen.getByText(/포맷을 1개 이상 등록해주세요/)
    ).toBeDefined();
  });

  it("renders list of formats", () => {
    render(
      <LiveFormatsSection
        liveId={1}
        initialFormats={[
          {
            id: 10,
            type: "LIVE_VENUE",
            label: null,
            venueName: "Arena",
            url: null,
          },
          {
            id: 11,
            type: "LIVE_VIEWING",
            label: "전국 5관 LV",
            venueName: null,
            url: null,
          },
        ]}
      />
    );
    expect(screen.getByText("Arena")).toBeDefined();
    expect(screen.getByText("전국 5관 LV")).toBeDefined();
  });

  it("opens create dialog when '+ 포맷 추가' clicked", async () => {
    render(<LiveFormatsSection liveId={1} initialFormats={[]} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /포맷 추가/ }));
    await act(async () => {});
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("successful create appends to list", async () => {
    createMock.mockResolvedValue({
      ok: true,
      format: {
        id: 99,
        liveId: 1,
        type: "STREAMING",
        label: "공식 배포",
        venueName: null,
        url: "https://example.com/s",
      },
    });

    render(<LiveFormatsSection liveId={1} initialFormats={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /포맷 추가/ }));
    await act(async () => {});

    fireEvent.change(screen.getByLabelText(/타입/), {
      target: { value: "STREAMING" },
    });
    fireEvent.change(screen.getByLabelText(/라벨/), {
      target: { value: "공식 배포" },
    });
    fireEvent.change(screen.getByLabelText(/^URL/), {
      target: { value: "https://example.com/s" },
    });

    const form = screen.getByRole("form", { name: "live-format-form" });
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText("공식 배포")).toBeDefined();
    });
  });

  it("edit dialog populates with selected format", async () => {
    render(
      <LiveFormatsSection
        liveId={1}
        initialFormats={[
          {
            id: 7,
            type: "LIVE_VIEWING",
            label: "초기 라벨",
            venueName: "초기 회장",
            url: null,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    await act(async () => {});

    expect((screen.getByLabelText(/라벨/) as HTMLInputElement).value).toBe(
      "초기 라벨"
    );
    expect((screen.getByLabelText(/회장명/) as HTMLInputElement).value).toBe(
      "초기 회장"
    );
    expect((screen.getByLabelText(/타입/) as HTMLSelectElement).value).toBe(
      "LIVE_VIEWING"
    );
  });

  it("optimistic delete + rollback on failure", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "삭제 실패" });

    render(
      <LiveFormatsSection
        liveId={1}
        initialFormats={[
          {
            id: 22,
            type: "LIVE_VENUE",
            label: null,
            venueName: "삭제 대상",
            url: null,
          },
        ]}
      />
    );

    expect(screen.getByText("삭제 대상")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "삭제 확정" }));
    });

    // 롤백 후 다시 보여야 한다.
    await waitFor(() => {
      expect(screen.getByText("삭제 대상")).toBeDefined();
    });
    expect(screen.getByRole("alert").textContent).toContain("삭제 실패");
  });

  it("optimistic delete persists on success", async () => {
    deleteMock.mockResolvedValue({ ok: true });

    render(
      <LiveFormatsSection
        liveId={1}
        initialFormats={[
          {
            id: 33,
            type: "LIVE_VENUE",
            label: null,
            venueName: "지워질 회장",
            url: null,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "삭제 확정" }));
    });

    await waitFor(() => {
      expect(screen.queryByText("지워질 회장")).toBeNull();
    });
  });

  it("각 format 의 tiers 데이터가 카드 안의 TicketTiersSubSection 으로 전달된다 (함수 prop 제거 — RSC 호환)", () => {
    render(
      <LiveFormatsSection
        liveId={1}
        initialFormats={[
          {
            id: 100,
            type: "LIVE_VENUE",
            label: null,
            venueName: "A",
            url: null,
            tiers: [
              { id: 11, name: "S석", priceJpy: 9800, order: 0, notes: null },
            ],
          },
          {
            id: 101,
            type: "LIVE_VIEWING",
            label: null,
            venueName: "B",
            url: null,
            tiers: [],
          },
        ]}
      />
    );

    // 각 카드 안에 티어 sub-section 헤딩 ("티켓 티어") 이 렌더된다.
    const tierHeadings = screen.getAllByText("티켓 티어");
    expect(tierHeadings.length).toBe(2);
    // 첫 번째 카드의 티어 이름이 보인다.
    expect(screen.getByDisplayValue("S석")).toBeDefined();
  });
});
