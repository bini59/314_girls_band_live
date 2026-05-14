// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { LiveFormatCard } from "./LiveFormatCard";

afterEach(cleanup);

const baseFormat = {
  id: 1,
  type: "LIVE_VIEWING" as const,
  label: "전국 5관 LV",
  venueName: "TOHO 시네마즈",
  url: "https://example.com/lv",
};

describe("LiveFormatCard", () => {
  it("renders type label, label, venueName, url", () => {
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    );

    expect(screen.getByText("라이브뷰잉")).toBeDefined();
    expect(screen.getByText("전국 5관 LV")).toBeDefined();
    expect(screen.getByText("TOHO 시네마즈")).toBeDefined();
    const link = screen.getByRole("link", { name: /example\.com/ });
    expect(link.getAttribute("href")).toBe("https://example.com/lv");
  });

  it("shows '현지 공연' for LIVE_VENUE", () => {
    render(
      <LiveFormatCard
        format={{ ...baseFormat, type: "LIVE_VENUE" }}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    );
    expect(screen.getByText("현지 공연")).toBeDefined();
  });

  it("shows '배포' for STREAMING", () => {
    render(
      <LiveFormatCard
        format={{ ...baseFormat, type: "STREAMING" }}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    );
    expect(screen.getByText("배포")).toBeDefined();
  });

  it("invokes onEdit when 편집 clicked", () => {
    const onEdit = vi.fn();
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={onEdit}
        onDelete={async () => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("delete shows confirm message before calling onDelete", async () => {
    const onDelete = vi.fn(async () => {});
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={() => {}}
        onDelete={onDelete}
      />
    );

    // 첫 클릭 → confirm 메시지 노출, onDelete 미호출.
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByText(/연결된 티어\/판매 라운드도 함께 사라집니다/)
    ).toBeDefined();

    // 두 번째 클릭 (삭제 확정) → onDelete 호출.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "삭제 확정" }));
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders tierSlot when provided", () => {
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={() => {}}
        onDelete={async () => {}}
        tierSlot={<div data-testid="tier-slot">TICKET TIERS</div>}
      />
    );
    expect(screen.getByTestId("tier-slot")).toBeDefined();
    expect(screen.getByText("TICKET TIERS")).toBeDefined();
  });

  it("does not render tierSlot when not provided", () => {
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={() => {}}
        onDelete={async () => {}}
      />
    );
    expect(screen.queryByTestId("tier-slot")).toBeNull();
  });

  it("disables actions when disabled prop is true", () => {
    render(
      <LiveFormatCard
        format={baseFormat}
        onEdit={() => {}}
        onDelete={async () => {}}
        disabled
      />
    );
    expect(
      (screen.getByRole("button", { name: "편집" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "삭제" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
