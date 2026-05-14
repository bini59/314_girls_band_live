/**
 * Input — Spotify 영감 텍스트 입력.
 *
 * 디자인 규칙 (.claude/DESIGN.md §4, §6):
 *   - 폼 인풋은 subtle radius(4px)
 *   - 보더는 라인 대신 inset box-shadow 로 "오목한" 촉각 부여
 *   - 포커스 시 그린 ring (focus-ring) overlay
 *   - 배경은 surface-2 (한 단계 위 표면) 사용 → 카드 위에서도 명확히 분리
 *
 * search 인풋(돋보기 아이콘 + pill)은 별도 ui (필요 시 SearchInput) 로 분리할 것.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none transition-shadow placeholder:text-[color:var(--color-muted-foreground)] shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
