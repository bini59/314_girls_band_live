/**
 * Dialog — Portal 기반 최소 접근성 모달.
 * - 배경 클릭 + ESC 닫기, focus trap, body scroll lock, ARIA(dialog/labelledby).
 */
"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog 하위 컴포넌트는 <Dialog> 안에서 사용해야 합니다.");
  }
  return ctx;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const reactId = React.useId();
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent({ className, children, ...props }, forwardedRef) {
    const { open, onOpenChange, titleId, descriptionId } = useDialogContext();
    const [mounted, setMounted] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

    // ref 병합
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    React.useEffect(() => {
      setMounted(true);
    }, []);

    // body scroll lock + open 시 초기 포커스 + close 시 포커스 복원
    React.useEffect(() => {
      if (!open) return;

      previouslyFocusedRef.current =
        typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null;

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // 첫 번째 focusable 또는 컨텐츠에 포커스
      const node = contentRef.current;
      if (node) {
        const firstFocusable = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          node.focus();
        }
      }

      return () => {
        document.body.style.overflow = prevOverflow;
        const prev = previouslyFocusedRef.current;
        if (prev && typeof prev.focus === "function") {
          prev.focus();
        }
      };
    }, [open, mounted]);

    // ESC + focus trap
    React.useEffect(() => {
      if (!open) return;

      function handleKeyDown(event: KeyboardEvent): void {
        if (event.key === "Escape") {
          event.stopPropagation();
          onOpenChange(false);
          return;
        }

        if (event.key !== "Tab") return;
        const node = contentRef.current;
        if (!node) return;

        const focusables = Array.from(
          node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusables.length === 0) {
          event.preventDefault();
          node.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onOpenChange]);

    if (!open || !mounted) return null;
    if (typeof document === "undefined") return null;

    const handleBackdropClick = (
      event: React.MouseEvent<HTMLDivElement>
    ): void => {
      if (event.target === event.currentTarget) {
        onOpenChange(false);
      }
    };

    return createPortal(
      <div
        data-testid="dialog-backdrop"
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity"
      >
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className={cn(
            "relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-6 text-[color:var(--color-foreground)] shadow-lg outline-none",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>,
      document.body
    );
  }
);

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function DialogTitle({ className, ...props }, ref) {
  const { titleId } = useDialogContext();
  return (
    <h2
      ref={ref}
      id={titleId}
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function DialogDescription({ className, ...props }, ref) {
  const { descriptionId } = useDialogContext();
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn("text-sm text-[color:var(--color-muted-foreground)]", className)}
      {...props}
    />
  );
});
