// @vitest-environment jsdom
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { VendorDialog } from "./VendorDialog";

/**
 * VendorDialog 컴포넌트 테스트 (jsdom).
 *
 * 검증:
 *  - 모든 필수 필드 렌더
 *  - 클라이언트 측 Zod 검증 (slug 형식)
 *  - 제출 중 버튼 비활성화
 *  - 서버 fieldErrors (P2002 slug) 가 화면에 노출
 *  - edit 모드는 initial 로 값 prefill
 */

afterEach(() => {
  document.body.style.overflow = "";
});

function Harness({
  mode = "create" as "create" | "edit",
  initial,
  onSubmit,
}: {
  mode?: "create" | "edit";
  initial?: Parameters<typeof VendorDialog>[0]["initial"];
  onSubmit: Parameters<typeof VendorDialog>[0]["onSubmit"];
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <VendorDialog
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      initial={initial}
      onSubmit={onSubmit}
    />
  );
}

describe("VendorDialog — create 모드", () => {
  it("slug / 이름 / 기본 URL / 로고 URL / 메모 필드가 렌더된다", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByLabelText("slug")).toBeDefined();
    expect(screen.getByLabelText("표시 이름")).toBeDefined();
    expect(screen.getByLabelText("기본 URL (선택)")).toBeDefined();
    expect(screen.getByLabelText("로고 URL (선택)")).toBeDefined();
    expect(screen.getByLabelText("메모 (선택)")).toBeDefined();
  });

  it("slug 형식 위반 (대문자) → 서버 호출 없이 fieldError 표시", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "EE-PLUS" },
    });
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "イープラス" },
    });

    const submit = screen.getByRole("button", { name: /^저장$/ });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(
        screen.getByText(/소문자\/숫자\/하이픈/)
      ).toBeDefined();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("정상 입력 → onSubmit 호출, 다이얼로그 닫힘", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: true } as { ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "ee-plus" },
    });
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "イープラス" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "ee-plus",
        name: "イープラス",
      })
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("서버에서 P2002 → fieldErrors.slug 가 화면에 노출되고 다이얼로그 유지", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      fieldErrors: { slug: ["이미 사용 중인 slug 입니다."] },
    });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "ee-plus" },
    });
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "イープラス" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/이미 사용 중인 slug/)).toBeDefined();
    });
    // 다이얼로그는 여전히 열려있음
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("제출 중 버튼이 비활성화되고 텍스트가 '저장 중...' 으로 바뀐다", async () => {
    let resolveSubmit: (v: { ok: true }) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "ee-plus" },
    });
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "イープラス" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /저장 중/ })
      ).toBeDefined();
    });
    const submitBtn = screen.getByRole("button", { name: /저장 중/ });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // cleanup — Promise 가 해소되어야 unhandled rejection 회피
    await act(async () => {
      resolveSubmit({ ok: true });
    });
  });
});

describe("VendorDialog — edit 모드", () => {
  it("initial 값으로 폼이 prefill 된다", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        mode="edit"
        initial={{
          slug: "lawson-ticket",
          name: "ローソンチケット",
          baseUrl: "https://l-tike.com",
          notes: "메모",
        }}
        onSubmit={onSubmit}
      />
    );

    expect(
      (screen.getByLabelText("slug") as HTMLInputElement).value
    ).toBe("lawson-ticket");
    expect(
      (screen.getByLabelText("표시 이름") as HTMLInputElement).value
    ).toBe("ローソンチケット");
    expect(
      (screen.getByLabelText("기본 URL (선택)") as HTMLInputElement).value
    ).toBe("https://l-tike.com");
    expect(
      (screen.getByLabelText("메모 (선택)") as HTMLTextAreaElement).value
    ).toBe("메모");
  });
});
