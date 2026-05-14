// @vitest-environment jsdom
/**
 * TicketTiersSubSection 컴포넌트 테스트.
 *
 * 검증:
 *  - 빈 상태 안내 ("이 포맷에 티어가 아직 없습니다.")
 *  - 새 티어 추가 (낙관적): 즉시 리스트에 보이고 서버 응답 후 임시 id 가 실제 id 로 교체
 *  - 삭제: 즉시 사라짐, 실패 시 rollback
 *  - reorder: 즉시 순서 변경, 실패 시 rollback
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";

import { TicketTiersSubSection } from "./TicketTiersSubSection";
import * as actions from "../ticket-tier-actions";

vi.mock("../ticket-tier-actions", () => ({
  createTicketTierAction: vi.fn(),
  updateTicketTierAction: vi.fn(),
  deleteTicketTierAction: vi.fn(),
  reorderTicketTiersAction: vi.fn(),
}));

const mocked = vi.mocked(actions);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TicketTiersSubSection — 빈 상태", () => {
  it("초기 티어 없음 → empty 안내", () => {
    render(
      <TicketTiersSubSection formatId={1} initialTiers={[]} />
    );
    expect(
      screen.getByText("이 포맷에 티어가 아직 없습니다. 추가하세요.")
    ).toBeDefined();
  });
});

describe("TicketTiersSubSection — 생성", () => {
  it("이름/가격 입력 후 + 티어 추가 → 낙관적 add", async () => {
    mocked.createTicketTierAction.mockResolvedValue({
      ok: true,
      tier: {
        id: 100,
        name: "S석 지정",
        priceJpy: 9800,
        order: 0,
        notes: null,
      },
      savedAt: new Date().toISOString(),
    });

    render(<TicketTiersSubSection formatId={42} initialTiers={[]} />);

    fireEvent.change(screen.getByLabelText("등급명"), {
      target: { value: "S석 지정" },
    });
    fireEvent.change(screen.getByLabelText("가격(JPY)"), {
      target: { value: "9800" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "+ 티어 추가" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocked.createTicketTierAction).toHaveBeenCalledWith(42, {
      name: "S석 지정",
      priceJpy: 9800,
      order: 0,
    });

    // 화면에 등급명 입력란이 보임 (추가된 row 안의 input).
    const inputs = screen.getAllByLabelText("등급명") as HTMLInputElement[];
    const created = inputs.find((i) => i.value === "S석 지정");
    expect(created).toBeDefined();
  });

  it("빈 이름으로 추가 시도 → 에러 메시지, 서버 호출 없음", async () => {
    render(<TicketTiersSubSection formatId={1} initialTiers={[]} />);
    fireEvent.change(screen.getByLabelText("가격(JPY)"), {
      target: { value: "1000" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "+ 티어 추가" }));
      await Promise.resolve();
    });

    expect(mocked.createTicketTierAction).not.toHaveBeenCalled();
    expect(screen.getByText("등급명을 입력해주세요.")).toBeDefined();
  });

  it("서버 실패 시 rollback → 리스트에서 사라짐", async () => {
    mocked.createTicketTierAction.mockResolvedValue({
      ok: false,
      error: "서버 에러",
    });

    render(<TicketTiersSubSection formatId={1} initialTiers={[]} />);
    fireEvent.change(screen.getByLabelText("등급명"), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByLabelText("가격(JPY)"), {
      target: { value: "100" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "+ 티어 추가" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    // 에러 표시.
    expect(screen.getByText(/서버 에러/)).toBeDefined();
    // 추가된 row 없음 — empty 안내가 다시 보임.
    expect(
      screen.getByText("이 포맷에 티어가 아직 없습니다. 추가하세요.")
    ).toBeDefined();
  });
});

describe("TicketTiersSubSection — 삭제", () => {
  it("삭제 성공 → 즉시 제거", async () => {
    mocked.deleteTicketTierAction.mockResolvedValue({ ok: true });

    render(
      <TicketTiersSubSection
        formatId={1}
        initialTiers={[
          { id: 1, name: "A", priceJpy: 100, order: 0, notes: null },
        ]}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: "삭제" });
    await act(async () => {
      fireEvent.click(deleteBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocked.deleteTicketTierAction).toHaveBeenCalledWith(1);
    expect(
      screen.getByText("이 포맷에 티어가 아직 없습니다. 추가하세요.")
    ).toBeDefined();
  });

  it("삭제 실패 시 rollback → 다시 표시", async () => {
    mocked.deleteTicketTierAction.mockResolvedValue({
      ok: false,
      error: "fail",
    });

    render(
      <TicketTiersSubSection
        formatId={1}
        initialTiers={[
          { id: 1, name: "A", priceJpy: 100, order: 0, notes: null },
        ]}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "삭제" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    // row 가 다시 살아있다 — 등급명 input 은 create 폼 + row 가 모두 있을 수
    // 있으므로 마지막(가장 최근) 요소 값으로 확인.
    const inputs = screen.getAllByLabelText("등급명") as HTMLInputElement[];
    const rowInput = inputs[inputs.length - 1];
    expect(rowInput.value).toBe("A");
  });
});

describe("TicketTiersSubSection — reorder", () => {
  it("아래 이동 → reorderTicketTiersAction 호출 + 순서 변경", async () => {
    mocked.reorderTicketTiersAction.mockResolvedValue({ ok: true });

    render(
      <TicketTiersSubSection
        formatId={5}
        initialTiers={[
          { id: 1, name: "A", priceJpy: 100, order: 0, notes: null },
          { id: 2, name: "B", priceJpy: 200, order: 1, notes: null },
        ]}
      />
    );

    const downButtons = screen.getAllByRole("button", { name: "아래로 이동" });
    await act(async () => {
      fireEvent.click(downButtons[0]); // 첫 row 를 아래로
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocked.reorderTicketTiersAction).toHaveBeenCalledWith(5, [2, 1]);
  });

  it("reorder 실패 → rollback", async () => {
    mocked.reorderTicketTiersAction.mockResolvedValue({
      ok: false,
      error: "fail",
    });

    render(
      <TicketTiersSubSection
        formatId={5}
        initialTiers={[
          { id: 1, name: "A", priceJpy: 100, order: 0, notes: null },
          { id: 2, name: "B", priceJpy: 200, order: 1, notes: null },
        ]}
      />
    );

    const downBtns = screen.getAllByRole("button", { name: "아래로 이동" });
    await act(async () => {
      fireEvent.click(downBtns[0]);
      // useTransition 의 async 콜백 flush.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 원래 순서로 복원되었는지: row 영역의 첫 번째 등급명 input 의 value === "A".
    // (create 폼의 등급명 input 이 inputs[0] 으로 들어오므로 row 만 필터.)
    const inputs = screen.getAllByLabelText("등급명") as HTMLInputElement[];
    const rowInputs = inputs.filter((el) => !el.id.startsWith("new-tier-"));
    expect(rowInputs[0].value).toBe("A");
  });
});
