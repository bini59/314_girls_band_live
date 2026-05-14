/**
 * Button — shadcn 스타일의 최소 버튼 (Tailwind v4 호환, CSS 변수 토큰 사용).
 *
 * variant: default | outline | destructive | ghost
 * size:    sm | md | lg
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:opacity-90",
  outline:
    "border border-[color:var(--color-border)] bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]",
  destructive:
    "bg-[color:var(--color-destructive)] text-[color:var(--color-destructive-foreground)] hover:opacity-90",
  ghost:
    "bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "default", size = "md", type, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className
        )}
        {...props}
      />
    );
  }
);
