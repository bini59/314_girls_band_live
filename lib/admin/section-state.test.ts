// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useSectionList } from "./section-state";

interface Tier {
  id: number;
  name: string;
}

const getKey = (t: Tier) => t.id;

const SEED: Tier[] = [
  { id: 1, name: "S" },
  { id: 2, name: "A" },
  { id: 3, name: "B" },
];

describe("useSectionList", () => {
  it("initialises with provided items", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));
    expect(result.current.items).toEqual(SEED);
  });

  it("add appends without mutating original", () => {
    const initial = [...SEED];
    const { result } = renderHook(() => useSectionList(initial, getKey));

    act(() => {
      result.current.add({ id: 4, name: "C" });
    });

    expect(result.current.items.map((t) => t.id)).toEqual([1, 2, 3, 4]);
    expect(initial).toEqual(SEED); // 원본 불변
  });

  it("remove filters by key", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));

    act(() => {
      result.current.remove(2);
    });

    expect(result.current.items.map((t) => t.id)).toEqual([1, 3]);
  });

  it("replace updates the matching item only", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));

    act(() => {
      result.current.replace(2, { id: 2, name: "AA" });
    });

    expect(result.current.items.find((t) => t.id === 2)?.name).toBe("AA");
    expect(result.current.items.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("reset replaces with server truth", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));

    const next: Tier[] = [{ id: 99, name: "Z" }];
    act(() => {
      result.current.reset(next);
    });

    expect(result.current.items).toEqual(next);
  });

  it("reorder reorders by provided keys, unknown keys preserved at end", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));

    act(() => {
      result.current.reorder([3, 1]); // 2 는 미지정 → 뒤에 보존
    });

    expect(result.current.items.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("reorder ignores keys not in current list", () => {
    const { result } = renderHook(() => useSectionList(SEED, getKey));

    act(() => {
      result.current.reorder([3, 999, 1, 2]);
    });

    expect(result.current.items.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("function identities are stable across renders when deps unchanged", () => {
    const { result, rerender } = renderHook(() =>
      useSectionList(SEED, getKey)
    );

    const firstAdd = result.current.add;
    const firstReset = result.current.reset;

    rerender();

    expect(result.current.add).toBe(firstAdd);
    expect(result.current.reset).toBe(firstReset);
  });
});
