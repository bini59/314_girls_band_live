import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "success";

const VARIANT_CLASS: Record<Variant, string> = {
  default:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]",
  secondary:
    "bg-[color:var(--color-muted)] text-[color:var(--color-muted-foreground)]",
  outline:
    "border border-[color:var(--color-border)] text-[color:var(--color-foreground)]",
  success: "bg-emerald-600 text-white",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    />
  );
}
