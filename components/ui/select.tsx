/**
 * Select — 네이티브 `<select>` 래퍼. Input 과 동일한 인셋 보더/포커스 스타일.
 * 콤보박스(검색·자동완성)는 `components/ui/combobox.tsx` 를 사용.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none transition-shadow shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
