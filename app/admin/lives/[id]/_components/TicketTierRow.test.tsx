// @vitest-environment jsdom
/**
 * TicketTierRow 컴포넌트 테스트.
 *
 * 검증:
 *  - name 입력 → 디바운스(800ms) 후 onUpdate 호출
 *  - 자동저장 인디케이터 상태 전이 (idle → dirty/saving → saved)
 *  - server fieldError 가 인라인 에러로 표시
 *  - priceJpy input 은 min=0
 *  - ↑/↓ 버튼이 경계에서 disabled
 */
import * as React from "react";
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";

import { TicketTierRow } from "./TicketTierRow";

const baseTier = {
  id: 10,
  name: "S석",
  priceJpy: 9800,
  order: 0,
  notes: null as string | null,
};

function setupProps(overrides: Partial<React.ComponentProps<typeof TicketTierRow>> = {}) {
  return {
    tier: baseTier,
    index: 0,
    total: 3,
    onUpdate: vi.fn(async () => ({
      ok: true as const,
      tier: { ...baseTier, name: "S석" },
      savedAt: new Date().toISOString(),
    })),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onDelete: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TicketTierRow", () => {
  it("초기 값으로 등급명/가격을 렌더한다", () => {
    const props = setupProps();
    render(<TicketTierRow {...props} />);
    expect((screen.getByLabelText("등급명") as HTMLInputElement).value).toBe(
      "S석"
    );
    expect(
      (screen.getByLabelText("가격 (JPY)") as HTMLInputElement).value
    ).toBe("9800");
  });

  it("등급명 입력 800ms 후 onUpdate 호출", async () => {
    const props = setupProps();
    render(<TicketTierRow {...props} />);

    const input = screen.getByLabelText("등급명") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "S 변경" } });

    // 디바운스 직전엔 호출 없음.
    expect(props.onUpdate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    // 마이크로태스크 flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(props.onUpdate).toHaveBeenCalledWith({ name: "S 변경" });
  });

  it("자동저장 상태 전이: dirty → saving → saved", async () => {
    let resolveFn: (v: {
      ok: true;
      tier: typeof baseTier;
      savedAt: string;
    }) => void = () => {};
    const onUpdate = vi.fn(
      () =>
        new Promise<{ ok: true; tier: typeof baseTier; savedAt: string }>(
          (resolve) => {
            resolveFn = resolve;
          }
        )
    );

    const props = setupProps({ onUpdate });
    render(<TicketTierRow {...props} />);

    const input = screen.getByLabelText("등급명") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "수정" } });

    // dirty 상태.
    expect(screen.getByText(/편집 중/)).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // saving.
    expect(screen.getByText(/저장 중/)).toBeDefined();

    await act(async () => {
      resolveFn({
        ok: true,
        tier: { ...baseTier, name: "수정" },
        savedAt: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    // saved.
    expect(screen.getByText(/저장됨/)).toBeDefined();
  });

  it("서버 fieldError 는 인라인 에러로 표시", async () => {
    const onUpdate = vi.fn(async () => ({
      ok: false as const,
      fieldErrors: { name: ["필수 입력 항목입니다."] },
    }));
    const props = setupProps({ onUpdate });
    render(<TicketTierRow {...props} />);

    const input = screen.getByLabelText("등급명") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("필수 입력 항목입니다.")).toBeDefined();
  });

  it("priceJpy 입력은 min=0 속성을 가진다", () => {
    const props = setupProps();
    render(<TicketTierRow {...props} />);
    const priceInput = screen.getByLabelText(
      "가격 (JPY)"
    ) as HTMLInputElement;
    expect(priceInput.min).toBe("0");
  });

  it("첫 행에선 ↑ 버튼 disabled, 마지막 행에선 ↓ 버튼 disabled", () => {
    const propsFirst = setupProps({ index: 0, total: 3 });
    const { rerender } = render(<TicketTierRow {...propsFirst} />);

    const upBtn = screen.getByRole("button", { name: "위로 이동" });
    const downBtn = screen.getByRole("button", { name: "아래로 이동" });
    expect((upBtn as HTMLButtonElement).disabled).toBe(true);
    expect((downBtn as HTMLButtonElement).disabled).toBe(false);

    const propsLast = setupProps({ index: 2, total: 3 });
    rerender(<TicketTierRow {...propsLast} />);
    const upBtn2 = screen.getByRole("button", { name: "위로 이동" });
    const downBtn2 = screen.getByRole("button", { name: "아래로 이동" });
    expect((upBtn2 as HTMLButtonElement).disabled).toBe(false);
    expect((downBtn2 as HTMLButtonElement).disabled).toBe(true);
  });

  it("삭제 버튼 클릭 시 onDelete 호출", async () => {
    const onDelete = vi.fn(async () => {});
    const props = setupProps({ onDelete });
    render(<TicketTierRow {...props} />);

    const btn = screen.getByRole("button", { name: "삭제" });
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
