import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export interface MarkdownProps {
  children: string;
  className?: string;
  size?: "sm" | "base";
}

export function Markdown({ children, className, size = "base" }: MarkdownProps) {
  const text = size === "sm" ? "text-xs" : "text-sm";
  const heading = size === "sm" ? "text-sm" : "text-base";

  return (
    <div
      className={cn(
        text,
        "leading-relaxed text-[color:var(--color-foreground)]",
        "[&>*+*]:mt-2",
        "[&_strong]:font-semibold [&_strong]:text-[color:var(--color-foreground)]",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:bg-[color:var(--color-muted)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_a]:text-[color:var(--color-primary)] [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:pl-1",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--color-border)] [&_blockquote]:pl-3 [&_blockquote]:text-[color:var(--color-muted-foreground)]",
        "[&_hr]:my-3 [&_hr]:border-[color:var(--color-border)]",
        `[&_h1]:font-semibold [&_h1]:${heading}`,
        `[&_h2]:font-semibold [&_h2]:${heading}`,
        `[&_h3]:font-semibold [&_h3]:${heading}`,
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:border [&_th]:border-[color:var(--color-border)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-[color:var(--color-border)] [&_td]:px-2 [&_td]:py-1",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...rest}
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
