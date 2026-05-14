// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ThemeToggle } from "./theme-toggle";
import { THEME_STORAGE_KEY } from "./theme-script";

function setMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    setMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("3개 옵션을 라디오로 노출한다", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "라이트" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "다크" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "시스템" })).toBeDefined();
  });

  it("다크 선택 시 html.dark 적용 + localStorage 저장", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "다크" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("라이트 선택 시 html.dark 제거", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "라이트" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("시스템 선택 시 prefers-color-scheme를 따른다", () => {
    setMatchMedia(true);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "시스템" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});
