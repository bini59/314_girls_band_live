// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TicketSaleDialog } from "./TicketSaleDialog";
import type { TierMultiSelectFormat } from "./TierMultiSelect";

const VENDORS = [
  { id: 1, name: "イープラス" },
  { id: 2, name: "ローソンチケット" },
];

const FORMATS: TierMultiSelectFormat[] = [
  {
    id: 1,
    type: "LIVE_VENUE",
    label: null,
    venueName: "Saitama",
    tiers: [{ id: 11, name: "S석", priceJpy: 9800 }],
  },
];

describe("TicketSaleDialog — create 모드", () => {
  it("열린 상태에서 모든 필드를 렌더링한다", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );

    expect(screen.getByLabelText(/발매처/)).toBeDefined();
    expect(screen.getByLabelText(/유형/)).toBeDefined();
    expect(screen.getByLabelText(/방식/)).toBeDefined();
    expect(screen.getByLabelText(/라벨/)).toBeDefined();
    expect(screen.getByLabelText(/시작 \(JST\)/)).toBeDefined();
    expect(screen.getByLabelText(/마감 \(JST\)/)).toBeDefined();
    expect(screen.getByLabelText(/발표 \(JST\)/)).toBeDefined();
    expect(screen.getByLabelText(/입금 기한/)).toBeDefined();
    expect(screen.getByLabelText("URL")).toBeDefined();
    expect(screen.getByLabelText(/노트/)).toBeDefined();
  });

  it("type select 는 9개 enum 옵션 (한국어) 을 표시한다", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    const typeSelect = screen.getByLabelText(/유형/) as HTMLSelectElement;
    expect(typeSelect.options.length).toBe(9);
    const labels = Array.from(typeSelect.options).map((o) => o.textContent);
    expect(labels).toContain("FC 선행");
    expect(labels).toContain("공식 선행");
    expect(labels).toContain("플레이가이드 선행");
    expect(labels).toContain("일반 발매");
    expect(labels).toContain("당일권");
    expect(labels).toContain("LV 선행");
    expect(labels).toContain("LV 일반");
    expect(labels).toContain("배포 티켓");
    expect(labels).toContain("기타");
  });

  it("method select 는 추첨 / 선착 2개 옵션", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    const methodSelect = screen.getByLabelText(/방식/) as HTMLSelectElement;
    const labels = Array.from(methodSelect.options).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(["추첨", "선착"]));
  });

  it("JST datetime-local 입력이 동작한다", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    const startsAt = screen.getByLabelText(/시작 \(JST\)/) as HTMLInputElement;
    expect(startsAt.type).toBe("datetime-local");
    fireEvent.change(startsAt, { target: { value: "2026-01-10T12:00" } });
    expect(startsAt.value).toBe("2026-01-10T12:00");
  });

  it("vendor 가 비어있으면 안내 메시지 + 폼 비활성화", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={[]}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    expect(screen.getByTestId("vendors-empty-notice")).toBeDefined();
    expect(
      screen.getByText(/admin\/vendors 에서 발매처를 먼저 등록해주세요/)
    ).toBeDefined();
    const submit = screen.getByRole("button", { name: "추가" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("서버 fieldErrors 를 받아 필드 옆에 표시", async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false as const,
      fieldErrors: {
        startsAtJst: ["시작 시간은 필수입니다."],
        vendorId: ["발매처를 선택해주세요."],
      },
    }));
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={onSubmit}
      />
    );
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText("시작 시간은 필수입니다.")).toBeDefined();
      expect(screen.getByText("발매처를 선택해주세요.")).toBeDefined();
    });
  });

  it("서버 global error 표시", async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false as const,
      error: "라운드 등록에 실패했습니다.",
    }));
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={onSubmit}
      />
    );
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText(/라운드 등록에 실패했습니다/)).toBeDefined();
    });
  });

  it("제출 중에는 submit 버튼 비활성화 + '저장 중...' 표시", async () => {
    let resolve: ((v: { ok: true }) => void) | null = null;
    const onSubmit = vi.fn(
      () =>
        new Promise<{ ok: true }>((r) => {
          resolve = r;
        })
    );
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={onSubmit}
      />
    );

    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);

    await waitFor(() => {
      const submit = screen.getByRole("button", { name: /저장 중/ });
      expect((submit as HTMLButtonElement).disabled).toBe(true);
    });
    resolve!({ ok: true });
  });

  it("성공 시 onOpenChange(false) 호출", async () => {
    const onOpenChange = vi.fn();
    render(
      <TicketSaleDialog
        open
        onOpenChange={onOpenChange}
        mode="create"
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("TicketSaleDialog — edit 모드", () => {
  it("initial 값으로 폼이 채워진다", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initial={{
          vendorId: 2,
          type: "IPPAN",
          method: "FIRST_COME",
          label: "기존 라벨",
          startsAtJst: "2026-02-01T10:00",
          endsAtJst: "2026-02-05T23:59",
          announceAtJst: "",
          paymentDeadlineAtJst: "",
          url: "https://eplus.jp/x",
          notes: "메모",
          tierIds: [11],
        }}
        vendors={VENDORS}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );

    expect(
      (screen.getByLabelText(/발매처/) as HTMLSelectElement).value
    ).toBe("2");
    expect((screen.getByLabelText(/유형/) as HTMLSelectElement).value).toBe(
      "IPPAN"
    );
    expect((screen.getByLabelText(/방식/) as HTMLSelectElement).value).toBe(
      "FIRST_COME"
    );
    expect((screen.getByLabelText(/라벨/) as HTMLInputElement).value).toBe(
      "기존 라벨"
    );
    expect(
      (screen.getByLabelText(/시작 \(JST\)/) as HTMLInputElement).value
    ).toBe("2026-02-01T10:00");
    expect((screen.getByLabelText("URL") as HTMLInputElement).value).toBe(
      "https://eplus.jp/x"
    );

    // tier 11 체크 상태
    const cb = screen.getByLabelText(/S석/) as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it("edit 모드에서는 vendors 비어있어도 안내 미표시 (이미 vendor 가 할당돼 있음)", () => {
    render(
      <TicketSaleDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initial={{
          vendorId: 99,
          type: "FC_SENKO",
          method: "LOTTERY",
          startsAtJst: "2026-01-10T12:00",
          tierIds: [],
        }}
        vendors={[]}
        formats={FORMATS}
        onSubmit={async () => ({ ok: true })}
      />
    );
    expect(screen.queryByTestId("vendors-empty-notice")).toBeNull();
  });
});
