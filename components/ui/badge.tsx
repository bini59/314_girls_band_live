/**
 * Badge — @bini59/design Badge 어댑터. 기존 variant 이름을 tone 으로 매핑.
 */
import * as React from "react";
import { Badge as DesignBadge } from "@bini59/design";

type Variant = "default" | "secondary" | "outline" | "success" | "warning" | "info";

const TONE = {
  default: "accent",
  secondary: "neutral",
  outline: "neutral",
  success: "ok",
  warning: "warn",
  info: "accent",
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "default", ...props }: BadgeProps) {
  return <DesignBadge tone={TONE[variant]} {...props} />;
}
