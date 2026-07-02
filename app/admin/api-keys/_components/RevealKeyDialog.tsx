"use client";

/**
 * RevealKeyDialog — 발급 직후 평문 키를 1회만 노출하는 모달.
 *
 * - 평문 키 + 복사 버튼 + "다시 볼 수 없습니다" 경고.
 * - 닫으면 평문은 부모 state 에서 폐기된다 (재표시 불가).
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface RevealKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 발급된 키 이름 (제목에 표시). */
  name: string;
  /** 평문 키 — 이 모달에서만 노출된다. */
  plaintext: string;
}

export function RevealKeyDialog({
  open,
  onOpenChange,
  name,
  plaintext,
}: RevealKeyDialogProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
    } catch (err) {
      console.error("[RevealKeyDialog] copy", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API 키 발급 완료</DialogTitle>
          <DialogDescription>
            &quot;{name}&quot; 키가 발급되었습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-[color:var(--color-warning)]/15 px-3 py-2 text-sm text-[color:var(--color-warning)]"
          >
            이 키는 지금 한 번만 표시됩니다. 안전한 곳에 복사해 보관하세요. 창을
            닫으면 다시 볼 수 없습니다.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reveal-plaintext">평문 키</Label>
            <div className="flex items-center gap-2">
              <input
                id="reveal-plaintext"
                readOnly
                value={plaintext}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 font-mono text-xs text-[color:var(--color-foreground)]"
                aria-label="발급된 평문 API 키"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                aria-label="평문 키 복사"
              >
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
