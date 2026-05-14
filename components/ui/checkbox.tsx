/**
 * Checkbox — 네이티브 `<input type="checkbox">` 래퍼. accent-color 로 Spotify Green 적용.
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
          "h-4 w-4 shrink-0 cursor-pointer rounded-[var(--radius-sm)] outline-none transition-shadow shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        style={{ accentColor: "var(--color-primary)" }}
        {...props}
      />
    );
  }
);
