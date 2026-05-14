/**
 * Button — Spotify 영감 pill 버튼 (Tailwind v4 + CSS 토큰).
 *
 * 디자인 규칙 (.claude/DESIGN.md §4 / §7):
 *   - 모든 버튼은 pill geometry (rounded-full)
 *   - 라벨은 트래킹(letter-spacing)을 주어 systemic label 음성 부여
 *   - primary 는 Spotify Green — CTA·확정·저장 전용
 *   - outline 은 light-border, 보조 액션
 *   - destructive 는 negative red, 삭제·되돌릴 수 없는 액션
 *   - ghost 는 헤더/툴바의 보조 액션 (배경 없음)
 *   - hover scale 미세하게 — Spotify 버튼의 촉각적 인상
 *
 * variant: default | primary | outline | destructive | ghost
 * size:    sm | md | lg | icon
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "outline" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASS: Record<Variant, string> = {
  // 'default' / 'primary' — Spotify Green CTA (저장·추가 등 주요 액션)
  default:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]",
  primary:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]",
  // 'outline' — 윤곽선 pill
  outline:
    "bg-transparent text-[color:var(--color-foreground)] border border-[color:var(--color-border)] hover:border-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)] active:scale-[0.98]",
  // 'destructive' — negative red
  destructive:
    "bg-[color:var(--color-destructive)] text-[color:var(--color-destructive-foreground)] hover:brightness-110 active:scale-[0.98]",
  // 'ghost' — 배경 없음, 호버시 옅은 muted
  ghost:
    "bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9 p-0",
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
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[var(--tracking-button)] outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-page)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className
        )}
        {...props}
      />
    );
  }
);
