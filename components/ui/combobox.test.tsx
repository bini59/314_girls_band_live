// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { Combobox } from "./combobox";

interface Band {
  id: number;
  name: string;
  work: string;
}

const BANDS: Band[] = [
  { id: 1, name: "MyGO!!!!!", work: "BanG Dream!" },
  { id: 2, name: "Ave Mujica", work: "BanG Dream!" },
  { id: 3, name: "Roselia", work: "BanG Dream!" },
];

function makeOnSearch() {
  return vi.fn(async (query: string) => {
    if (!query) return BANDS;
    return BANDS.filter((b) =>
      b.name.toLowerCase().includes(query.toLowerCase())
    );
  });
}

function Harness({
  onSearch,
  onChange,
  initial = null,
}: {
  onSearch: (q: string) => Promise<Band[]>;
  onChange?: (b: Band | null) => void;
  initial?: Band | null;
}) {
  const [value, setValue] = React.useState<Band | null>(initial);
  return (
    <Combobox<Band>
      value={value}
      onChange={(b) => {
        setValue(b);
        onChange?.(b);
      }}
      onSearch={onSearch}
      getKey={(b) => b.id}
      getLabel={(b) => b.name}
      getDescription={(b) => b.work}
      debounceMs={300}
      placeholder="밴드 검색"
    />
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Combobox", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on focus and debounces search", async () => {
    const onSearch = makeOnSearch();
    render(<Harness onSearch={onSearch} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushPromises();
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("ArrowDown + Enter selects highlighted item", async () => {
    const onSearch = makeOnSearch();
    const onChange = vi.fn();
    render(<Harness onSearch={onSearch} onChange={onChange} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    // 첫 옵션이 active(0) → ArrowDown 한번 → 1
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]?.id).toBe(BANDS[1].id);
  });

  it("Escape closes the listbox", async () => {
    const onSearch = makeOnSearch();
    render(<Harness onSearch={onSearch} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.queryByRole("listbox")).not.toBeNull();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on outside click", async () => {
    const onSearch = makeOnSearch();
    render(
      <div>
        <Harness onSearch={onSearch} />
        <button data-testid="outside">바깥</button>
      </div>
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.queryByRole("listbox")).not.toBeNull();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows emptyText when results empty", async () => {
    const onSearch = vi.fn(async () => [] as Band[]);
    render(<Harness onSearch={onSearch} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzz" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.getByText("결과 없음")).toBeDefined();
  });

  it("calls onChange(null) on backspace at empty query when value selected", async () => {
    const onSearch = makeOnSearch();
    const onChange = vi.fn();
    render(<Harness onSearch={onSearch} onChange={onChange} initial={BANDS[0]} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    // focus → query="" 로 표시값 비워짐. backspace 발생.
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
