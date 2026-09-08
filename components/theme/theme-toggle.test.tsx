// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ThemeToggle } from "./theme-toggle";
import { ThemeScript } from "./theme-script";
import { THEME_STORAGE_KEY } from "@bini59/design";

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
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
    setMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("저장한 테마를 초기 스크립트와 토글이 동일하게 복원한다", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { container, unmount } = render(<ThemeScript />);
    window.eval(container.querySelector("script")!.textContent!);
    expect(document.documentElement.dataset.theme).toBe("dark");
    unmount();
    render(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "다크" }).getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("3개 옵션을 라디오로 노출한다", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "라이트" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "다크" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "시스템" })).toBeDefined();
  });

  it("다크 선택 시 data-theme 적용 + localStorage 저장", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "다크" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("라이트 선택 시 data-theme 변경", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "라이트" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("시스템 선택 시 prefers-color-scheme를 따른다", () => {
    setMatchMedia(true);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("radio", { name: "시스템" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});
