// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LiveBandRow } from "./LiveBandRow";

function makeLiveBand(overrides: Partial<{
  bandId: number;
  isHeadliner: boolean;
  order: number;
  nameKo: string;
  nameJp: string;
}> = {}) {
  return {
    bandId: overrides.bandId ?? 1,
    isHeadliner: overrides.isHeadliner ?? false,
    order: overrides.order ?? 0,
    band: {
      nameKo: overrides.nameKo ?? "마이고",
      nameJp: overrides.nameJp ?? "MyGO!!!!!",
    },
  };
}

describe("LiveBandRow", () => {
  it("renders nameKo and nameJp", () => {
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={0}
          total={1}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    expect(screen.getByText("마이고")).toBeDefined();
    expect(screen.getByText("MyGO!!!!!")).toBeDefined();
  });

  it("disables move-up at index 0", () => {
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={0}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    const up = screen.getByRole("button", { name: "위로 이동" }) as HTMLButtonElement;
    const down = screen.getByRole("button", { name: "아래로 이동" }) as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(false);
  });

  it("disables move-down at last index", () => {
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={2}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    const up = screen.getByRole("button", { name: "위로 이동" }) as HTMLButtonElement;
    const down = screen.getByRole("button", { name: "아래로 이동" }) as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    expect(down.disabled).toBe(true);
  });

  it("enables both buttons in the middle", () => {
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={1}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    const up = screen.getByRole("button", { name: "위로 이동" }) as HTMLButtonElement;
    const down = screen.getByRole("button", { name: "아래로 이동" }) as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    expect(down.disabled).toBe(false);
  });

  it("headliner checkbox toggles onUpdate({ isHeadliner: true })", () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand({ isHeadliner: false })}
          index={0}
          total={1}
          onUpdate={onUpdate}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    const cb = screen.getByLabelText("헤드라이너") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(onUpdate).toHaveBeenCalledWith({ isHeadliner: true });
  });

  it("move-up button calls onMoveUp", () => {
    const onMoveUp = vi.fn().mockResolvedValue(undefined);
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={1}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={onMoveUp}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    fireEvent.click(screen.getByRole("button", { name: "위로 이동" }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it("move-down button calls onMoveDown", () => {
    const onMoveDown = vi.fn().mockResolvedValue(undefined);
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={0}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={onMoveDown}
          onRemove={vi.fn().mockResolvedValue(undefined)}
        />
      </ul>
    );
    fireEvent.click(screen.getByRole("button", { name: "아래로 이동" }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it("remove button calls onRemove", () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={0}
          total={1}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={onRemove}
        />
      </ul>
    );
    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disabled prop disables all controls", () => {
    render(
      <ul>
        <LiveBandRow
          liveBand={makeLiveBand()}
          index={1}
          total={3}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          onMoveUp={vi.fn().mockResolvedValue(undefined)}
          onMoveDown={vi.fn().mockResolvedValue(undefined)}
          onRemove={vi.fn().mockResolvedValue(undefined)}
          disabled
        />
      </ul>
    );
    const cb = screen.getByLabelText("헤드라이너") as HTMLInputElement;
    expect(cb.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "위로 이동" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "아래로 이동" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "제거" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
