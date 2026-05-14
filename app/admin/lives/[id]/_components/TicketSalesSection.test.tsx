// @vitest-environment jsdom
import * as React from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { SerializedTicketSale } from "../ticket-sale-actions";
import type { TierMultiSelectFormat } from "./TierMultiSelect";

// 서버 액션 모킹.
const createAction = vi.fn();
const updateAction = vi.fn();
const setTiersAction = vi.fn();
const deleteAction = vi.fn();

vi.mock("../ticket-sale-actions", () => ({
  createTicketSaleAction: (...args: unknown[]) => createAction(...args),
  updateTicketSaleAction: (...args: unknown[]) => updateAction(...args),
  setTicketSaleTiersAction: (...args: unknown[]) => setTiersAction(...args),
  deleteTicketSaleAction: (...args: unknown[]) => deleteAction(...args),
}));

// 동적 import — mock 이후 로드.
import { TicketSalesSection } from "./TicketSalesSection";

const VENDORS = [{ id: 1, name: "イープラス" }];
const FORMATS: TierMultiSelectFormat[] = [
  {
    id: 1,
    type: "LIVE_VENUE",
    tiers: [{ id: 11, name: "S석", priceJpy: 9800 }],
  },
];

function makeSale(overrides: Partial<SerializedTicketSale> = {}): SerializedTicketSale {
  return {
    id: 100,
    liveId: 1,
    vendorId: 1,
    vendor: { id: 1, name: "イープラス", slug: "eplus" },
    type: "FC_SENKO",
    method: "LOTTERY",
    label: "FC 선행 라운드",
    startsAt: "2026-01-10T03:00:00.000Z",
    endsAt: "2026-01-15T14:59:00.000Z",
    announceAt: null,
    paymentDeadlineAt: null,
    url: null,
    notes: null,
    tiers: [],
    ...overrides,
  };
}

beforeEach(() => {
  createAction.mockReset();
  updateAction.mockReset();
  setTiersAction.mockReset();
  deleteAction.mockReset();
});

describe("TicketSalesSection — 렌더링", () => {
  it("initialSales 비어있으면 빈 상태 안내", () => {
    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );
    expect(screen.getByTestId("ticket-sales-empty")).toBeDefined();
    expect(
      screen.getByText(/판매\/추첨 라운드를 추가하세요/)
    ).toBeDefined();
  });

  it("sales 가 startsAt asc 로 정렬돼 렌더링", () => {
    const a = makeSale({ id: 101, startsAt: "2026-02-10T03:00:00.000Z" });
    const b = makeSale({ id: 102, startsAt: "2026-01-10T03:00:00.000Z" });
    const c = makeSale({ id: 103, startsAt: "2026-03-10T03:00:00.000Z" });
    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[a, b, c]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );
    const cards = screen.getAllByTestId(/ticket-sale-card-/);
    expect(cards.map((el) => el.getAttribute("data-testid"))).toEqual([
      "ticket-sale-card-102",
      "ticket-sale-card-101",
      "ticket-sale-card-103",
    ]);
  });
});

describe("TicketSalesSection — 추가 (옵티미스틱 + 롤백)", () => {
  it("create 성공 시 새 카드가 추가됨", async () => {
    const newSale = makeSale({ id: 200, label: "신규" });
    (createAction as Mock).mockResolvedValueOnce({ ok: true, sale: newSale });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /라운드 추가/ }));
    const startsAt = await screen.findByLabelText(/시작 \(JST\)/);
    fireEvent.change(startsAt, { target: { value: "2026-01-10T12:00" } });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => {
      expect(screen.queryByTestId("ticket-sale-card-200")).not.toBeNull();
    });
    expect(createAction).toHaveBeenCalled();
  });

  it("create 실패 시 카드 미추가", async () => {
    (createAction as Mock).mockResolvedValueOnce({
      ok: false,
      error: "에러",
    });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /라운드 추가/ }));
    const startsAt = await screen.findByLabelText(/시작 \(JST\)/);
    fireEvent.change(startsAt, { target: { value: "2026-01-10T12:00" } });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("에러")).toBeDefined();
    });
    expect(screen.queryByTestId(/ticket-sale-card-/)).toBeNull();
  });
});

describe("TicketSalesSection — 편집", () => {
  it("편집 버튼 → 다이얼로그가 기존 값으로 열림", async () => {
    const sale = makeSale({ id: 300, label: "원래 라벨" });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[sale]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    await waitFor(() => {
      const label = screen.getByLabelText(/라벨/) as HTMLInputElement;
      expect(label.value).toBe("원래 라벨");
    });
  });

  it("edit 실패 시 카드가 원래 상태로 롤백", async () => {
    const sale = makeSale({ id: 301, label: "원래" });
    (updateAction as Mock).mockResolvedValueOnce({
      ok: false,
      error: "수정 실패",
    });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[sale]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    const label = await screen.findByLabelText(/라벨/);
    fireEvent.change(label, { target: { value: "변경됨" } });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("수정 실패")).toBeDefined();
    });
    // 카드는 원래 라벨로 (이미 닫혀있는 다이얼로그 외부, 카드 영역) 유지.
    const card = screen.getByTestId("ticket-sale-card-301");
    expect(card.textContent).toContain("원래");
  });
});

describe("TicketSalesSection — 삭제 (옵티미스틱 + 롤백)", () => {
  it("delete 성공 시 카드가 즉시 사라지고 액션 호출", async () => {
    const sale = makeSale({ id: 400 });
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    (deleteAction as Mock).mockResolvedValueOnce({ ok: true });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[sale]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(screen.queryByTestId("ticket-sale-card-400")).toBeNull();
    });
    expect(deleteAction).toHaveBeenCalledWith(400);
    spy.mockRestore();
  });

  it("delete 실패 시 카드가 복원", async () => {
    const sale = makeSale({ id: 401 });
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    (deleteAction as Mock).mockResolvedValueOnce({
      ok: false,
      error: "삭제 실패",
    });

    render(
      <TicketSalesSection
        liveId={1}
        initialSales={[sale]}
        vendors={VENDORS}
        formats={FORMATS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(screen.queryByTestId("ticket-sale-card-401")).not.toBeNull();
    });
    spy.mockRestore();
  });
});
