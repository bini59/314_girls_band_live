// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

function Harness({
  initialOpen = true,
  onCloseSpy,
}: {
  initialOpen?: boolean;
  onCloseSpy?: (next: boolean) => void;
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onCloseSpy?.(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>제목</DialogTitle>
            <DialogDescription>설명</DialogDescription>
          </DialogHeader>
          <input aria-label="first-input" />
          <DialogFooter>
            <button>확인</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders dialog with role + aria-modal when open", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("does not render content when closed", () => {
    render(<Harness initialOpen={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on ESC", () => {
    const onClose = vi.fn();
    render(<Harness onCloseSpy={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<Harness onCloseSpy={onClose} />);
    const backdrop = screen.getByTestId("dialog-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("does not close when content panel clicked", () => {
    const onClose = vi.fn();
    render(<Harness onCloseSpy={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses first focusable element on open", async () => {
    render(<Harness />);
    await act(async () => {
      // useEffect 가 발생하도록 await
    });
    expect(document.activeElement).toBe(screen.getByLabelText("first-input"));
  });

  it("locks body scroll while open", () => {
    render(<Harness initialOpen={true} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll after close", async () => {
    render(<Harness initialOpen={true} />);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {});
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("restores focus to opener after close", async () => {
    function FocusHarness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>t</DialogTitle>
              <button>action</button>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    render(<FocusHarness />);
    const opener = screen.getByText("opener") as HTMLButtonElement;
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    await act(async () => {});
    // 다이얼로그 안 버튼이 포커스됨
    expect(document.activeElement).toBe(screen.getByText("action"));

    // ESC 로 닫기
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {});
    // opener 로 복귀
    expect(document.activeElement).toBe(opener);
  });
});
