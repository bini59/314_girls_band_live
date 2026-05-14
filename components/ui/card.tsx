/**
 * Card — Spotify 영감 카드 컨테이너.
 *
 * 디자인 규칙 (.claude/DESIGN.md §4):
 *   - 8px radius, 가시 보더 없음
 *   - 배경은 surface (--color-background)
 *   - 호버 시 옅은 elevation
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-lg)] bg-[color:var(--color-background)] text-[color:var(--color-foreground)] transition-shadow hover:shadow-[var(--shadow-elevated)]",
        className
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1 p-6", className)}
      {...props}
    />
  );
});

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn("text-lg font-bold leading-none", className)}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardContent({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  );
});
