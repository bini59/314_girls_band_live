/**
 * SectionCard — 라이브 상세 어드민의 표준 섹션 카드.
 * placeholder 와 달리 실제 콘텐츠 섹션(밴드/포맷/티어/라운드/노트)에 사용.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "warning";
  className?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  tone = "default",
  className,
}: SectionCardProps) {
  const toneBorder =
    tone === "warning"
      ? "border-[color:var(--color-destructive)]"
      : "border-[color:var(--color-border)]";

  return (
    <section
      data-tone={tone}
      className={cn(
        "rounded-[var(--radius-lg)] border bg-[color:var(--color-background)] p-6 shadow-sm",
        toneBorder,
        className
      )}
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-[color:var(--color-foreground)]">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
