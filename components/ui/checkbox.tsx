/**
 * Checkbox — 네이티브 `<input type="checkbox">` 래퍼. accent-color 로 브랜드 색 적용.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        style={{ accentColor: "var(--color-primary)" }}
        {...props}
      />
    );
  }
);
