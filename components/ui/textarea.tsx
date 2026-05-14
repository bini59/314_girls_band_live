/**
 * Textarea — Input 과 동일한 인셋 보더/포커스 스타일.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none transition-shadow placeholder:text-[color:var(--color-muted-foreground)] shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
