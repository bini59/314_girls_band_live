import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "success" | "warning" | "info";

const VARIANT_CLASS: Record<Variant, string> = {
  default:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]",
  secondary:
    "bg-[color:var(--color-muted)] text-[color:var(--color-muted-foreground)]",
  outline:
    "border border-[color:var(--color-border)] text-[color:var(--color-foreground)]",
  success:
    "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]",
  warning:
    "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
  info:
    "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[var(--tracking-button)]",
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    />
  );
}
