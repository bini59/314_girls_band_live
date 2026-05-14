// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TicketSaleCard } from "./TicketSaleCard";
import type { SerializedTicketSale } from "../ticket-sale-actions";

const SALE: SerializedTicketSale = {
  id: 100,
  liveId: 1,
  vendorId: 1,
  vendor: { id: 1, name: "イープラス", slug: "eplus" },
  type: "FC_SENKO",
  method: "LOTTERY",
  label: "FC 最速先行",
  // JST 2026-01-10 12:00 = UTC 2026-01-10 03:00
  startsAt: "2026-01-10T03:00:00.000Z",
  endsAt: "2026-01-15T14:59:00.000Z",
  announceAt: "2026-01-20T01:00:00.000Z",
  paymentDeadlineAt: null,
  url: null,
  notes: null,
  tiers: [
    { id: 11, name: "S석", priceJpy: 9800, formatId: 1 },
    { id: 12, name: "스탠딩", priceJpy: 7800, formatId: 1 },
  ],
};

describe("TicketSaleCard", () => {
  it("type / method 한국어 라벨로 배지 표시", () => {
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText("FC 선행")).toBeDefined();
    expect(screen.getByText("추첨")).toBeDefined();
  });

  it("라벨 + 발매처명 표시", () => {
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText("FC 最速先行")).toBeDefined();
    expect(screen.getByText(/イープラス/)).toBeDefined();
  });

  it("JST 시각 포맷 (시작/마감/발표)", () => {
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={() => {}} />
    );
    // JST 12:00 표시 (formatJstDateTime 결과: "YYYY-MM-DD HH:mm")
    expect(screen.getByText("2026-01-10 12:00")).toBeDefined();
    expect(screen.getByText("2026-01-15 23:59")).toBeDefined();
    expect(screen.getByText("2026-01-20 10:00")).toBeDefined();
  });

  it("tier chip 렌더링 (이름 + ¥가격)", () => {
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={() => {}} />
    );
    const list = screen.getByTestId("tier-chips-100");
    expect(list).toBeDefined();
    expect(screen.getByText(/S석/)).toBeDefined();
    expect(screen.getByText(/¥9,800/)).toBeDefined();
    expect(screen.getByText(/스탠딩/)).toBeDefined();
    expect(screen.getByText(/¥7,800/)).toBeDefined();
  });

  it("tier 가 없으면 '연결된 티어 없음'", () => {
    render(
      <TicketSaleCard
        sale={{ ...SALE, tiers: [] }}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText(/연결된 티어 없음/)).toBeDefined();
  });

  it("편집 버튼 클릭 시 onEdit 호출", () => {
    const onEdit = vi.fn();
    render(
      <TicketSaleCard sale={SALE} onEdit={onEdit} onDelete={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("삭제 버튼 클릭 → confirm 후 onDelete", () => {
    const onDelete = vi.fn();
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(spy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("삭제 confirm 취소 → onDelete 미호출", () => {
    const onDelete = vi.fn();
    const spy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <TicketSaleCard sale={SALE} onEdit={() => {}} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("라벨이 비어있으면 type 한국어 라벨이 fallback", () => {
    render(
      <TicketSaleCard
        sale={{ ...SALE, label: null }}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    // 배지 + fallback 표시 (FC 선행) 모두 등장.
    const matches = screen.getAllByText("FC 선행");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
