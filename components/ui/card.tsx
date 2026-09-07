/**
 * Card — 컨테이너. @bini59/design Card 와 같은 표면(border-line + bg-panel + rounded-lg).
 * design Card 는 내부 p-4 를 강제하므로 여기서는 표면만 맞추고 CardContent 로 여백을 제어한다.
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
        "rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] text-[color:var(--color-foreground)]",
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
