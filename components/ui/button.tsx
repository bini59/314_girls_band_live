/**
 * Button — @bini59/design Button 어댑터.
 *
 * 기존 variant/size 이름을 design 패키지 이름으로 매핑해 어드민 호출부를 그대로 유지한다.
 *   default|primary → accent, outline → default, destructive → danger, ghost → ghost
 *   sm → sm, md|lg|icon → md
 */
"use client";

import * as React from "react";
import { Button as DesignButton } from "@bini59/design";

import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "outline" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT = {
  default: "accent",
  primary: "accent",
  outline: "default",
  destructive: "danger",
  ghost: "ghost",
} as const;

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <DesignButton
      variant={VARIANT[variant]}
      size={size === "sm" ? "sm" : "md"}
      className={cn(size === "icon" && "w-8 px-0", className)}
      {...props}
    />
  );
}
