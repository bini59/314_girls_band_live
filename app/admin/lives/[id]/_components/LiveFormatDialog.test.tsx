// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { LiveFormatDialog } from "./LiveFormatDialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

function makeOnSubmit(result: Awaited<ReturnType<typeof vi.fn>> | unknown) {
  return vi.fn(async () => result as never);
}

describe("LiveFormatDialog", () => {
  it("renders fields with Korean type labels", () => {
    render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={makeOnSubmit({ ok: true, format: { id: 1 } })}
      />
    );

    // 한국어 라벨이 옵션에 나타난다.
    expect(screen.getByText("현지 공연")).toBeDefined();
    expect(screen.getByText("라이브뷰잉")).toBeDefined();
    expect(screen.getByText("배포")).toBeDefined();

    // 입력 필드들이 존재한다.
    expect(screen.getByLabelText(/타입/)).toBeDefined();
    expect(screen.getByLabelText(/라벨/)).toBeDefined();
    expect(screen.getByLabelText(/회장명/)).toBeDefined();
    expect(screen.getByLabelText(/^URL/)).toBeDefined();
  });

  it("submits with valid values + closes via onOpenChange(false)", async () => {
    const onSubmit = makeOnSubmit({ ok: true, format: { id: 10 } });
    const onOpenChange = vi.fn();

    render(
      <LiveFormatDialog
        open
        onOpenChange={onOpenChange}
        mode="create"
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/타입/), {
      target: { value: "LIVE_VIEWING" },
    });
    fireEvent.change(screen.getByLabelText(/라벨/), {
      target: { value: "전국 5관 LV" },
    });

    const form = screen.getByRole("form", { name: "live-format-form" });
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      type: "LIVE_VIEWING",
      label: "전국 5관 LV",
      venueName: "",
      url: "",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows field errors when server returns fieldErrors", async () => {
    const onSubmit = makeOnSubmit({
      ok: false,
      fieldErrors: { url: ["올바른 URL 이 아닙니다."] },
    });

    render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/^URL/), {
      target: { value: "https://valid.example" },
    });

    const form = screen.getByRole("form", { name: "live-format-form" });
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/올바른 URL/)).toBeDefined();
    });
  });

  it("client-side zod rejects invalid url before calling onSubmit", async () => {
    const onSubmit = makeOnSubmit({ ok: true });

    render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/^URL/), {
      target: { value: "not-a-url" },
    });

    const form = screen.getByRole("form", { name: "live-format-form" });
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/올바른 URL/)).toBeDefined();
  });

  it("disables submit button while pending", async () => {
    let resolveSubmit: ((v: unknown) => void) | null = null;
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve as (v: unknown) => void;
        })
    );

    render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={onSubmit as never}
      />
    );

    const form = screen.getByRole("form", { name: "live-format-form" });
    await act(async () => {
      fireEvent.submit(form);
    });

    const submitBtn = screen.getByRole("button", { name: /저장 중|추가/ });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolveSubmit?.({ ok: true, format: { id: 1 } });
    });
  });

  it("resets values when dialog reopens", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <LiveFormatDialog
            open={open}
            onOpenChange={setOpen}
            mode="create"
            onSubmit={async () => ({ ok: true })}
          />
        </>
      );
    }

    render(<Harness />);

    const label = screen.getByLabelText(/라벨/) as HTMLInputElement;
    fireEvent.change(label, { target: { value: "dirty" } });
    expect(label.value).toBe("dirty");

    // 닫기
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {});

    // 다시 열기
    fireEvent.click(screen.getByText("open"));
    await act(async () => {});

    const labelAfter = screen.getByLabelText(/라벨/) as HTMLInputElement;
    expect(labelAfter.value).toBe("");
  });

  it("venueName placeholder varies by type", () => {
    const { rerender } = render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="create"
        onSubmit={async () => ({ ok: true })}
      />
    );

    const venueInput = screen.getByLabelText(/회장명/) as HTMLInputElement;
    // 기본 LIVE_VENUE placeholder.
    expect(venueInput.placeholder).not.toBe("전국 5관 LV");

    fireEvent.change(screen.getByLabelText(/타입/), {
      target: { value: "LIVE_VIEWING" },
    });
    expect(
      (screen.getByLabelText(/회장명/) as HTMLInputElement).placeholder
    ).toBe("전국 5관 LV");

    fireEvent.change(screen.getByLabelText(/타입/), {
      target: { value: "STREAMING" },
    });
    expect(
      (screen.getByLabelText(/회장명/) as HTMLInputElement).placeholder
    ).toBe("(URL 만 필요)");

    rerender(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initial={{
          id: 1,
          type: "LIVE_VENUE",
          label: null,
          venueName: null,
          url: null,
        }}
        onSubmit={async () => ({ ok: true })}
      />
    );
  });

  it("populates initial values in edit mode", () => {
    render(
      <LiveFormatDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initial={{
          id: 5,
          type: "STREAMING",
          label: "공식 배포",
          venueName: null,
          url: "https://example.com/stream",
        }}
        onSubmit={async () => ({ ok: true })}
      />
    );

    expect((screen.getByLabelText(/타입/) as HTMLSelectElement).value).toBe(
      "STREAMING"
    );
    expect((screen.getByLabelText(/라벨/) as HTMLInputElement).value).toBe(
      "공식 배포"
    );
    expect((screen.getByLabelText(/^URL/) as HTMLInputElement).value).toBe(
      "https://example.com/stream"
    );
  });
});
