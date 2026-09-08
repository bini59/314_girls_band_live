/**
 * Input — Spotify 영감 텍스트 입력.
 *
 * 디자인 규칙: 입력 상태와 포커스 표시를 일관되게 유지한다.
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
        "flex h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none transition-colors placeholder:text-[color:var(--color-muted-foreground)] focus-visible:border-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});
