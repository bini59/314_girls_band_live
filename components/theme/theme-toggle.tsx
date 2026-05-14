"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { THEME_STORAGE_KEY } from "./theme-script";

export type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "라이트",
    icon: (
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "다크",
    icon: (
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "시스템",
    icon: (
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

function applyTheme(theme: Theme): void {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // ignore
  }
  return "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  // 'system' 선택 시 OS 변경 추적.
  React.useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  function handleChange(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={cn(
        "inline-flex items-center rounded-full bg-[color:var(--color-muted)] p-0.5",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const active = mounted && opt.value === theme;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => handleChange(opt.value)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] transition-colors",
              "hover:text-[color:var(--color-foreground)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]",
              active &&
                "bg-[color:var(--color-background)] text-[color:var(--color-foreground)] shadow-[var(--shadow-elevated)]"
            )}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
