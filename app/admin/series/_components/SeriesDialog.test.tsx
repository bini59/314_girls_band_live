// @vitest-environment jsdom
import * as React from "react";
import {
  afterEach,
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

import { SeriesDialog } from "./SeriesDialog";

afterEach(() => {
  document.body.style.overflow = "";
});

function Harness({
  mode = "create" as "create" | "edit",
  initial,
  onSubmit,
}: {
  mode?: "create" | "edit";
  initial?: Parameters<typeof SeriesDialog>[0]["initial"];
  onSubmit: Parameters<typeof SeriesDialog>[0]["onSubmit"];
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <SeriesDialog
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      initial={initial}
      onSubmit={onSubmit}
    />
  );
}

describe("SeriesDialog — create 모드", () => {
  it("모든 필드가 렌더된다", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByLabelText("slug")).toBeDefined();
    expect(screen.getByLabelText("한국어 이름")).toBeDefined();
    expect(screen.getByLabelText("일본어 이름")).toBeDefined();
    expect(screen.getByLabelText("영어 이름 (선택)")).toBeDefined();
    expect(screen.getByLabelText("로고 URL (선택)")).toBeDefined();
    expect(screen.getByLabelText("설명 (선택)")).toBeDefined();
  });

  it("slug 형식 위반 → 서버 호출 없이 fieldError 표시", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "Love Live" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "러브라이브" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "ラブライブ!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^저장$/ }));

    await waitFor(() => {
      expect(screen.getByText(/소문자\/숫자\/하이픈/)).toBeDefined();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("정상 입력 → onSubmit 호출, 다이얼로그 닫힘", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "love-live" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "러브라이브" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "ラブライブ!" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "love-live",
        nameKo: "러브라이브",
        nameJp: "ラブライブ!",
      })
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("서버 P2002 slug 중복 → fieldError 표시, 다이얼로그 유지", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      fieldErrors: { slug: ["이미 사용 중인 slug 입니다."] },
    });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "love-live" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "러브라이브" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "ラブライブ!" },
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
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
});

describe("SeriesDialog — edit 모드", () => {
  it("initial 값으로 폼이 prefill 된다", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        mode="edit"
        initial={{
          slug: "lovelive-sunshine",
          nameKo: "러브라이브 선샤인",
          nameJp: "ラブライブ! サンシャイン!!",
          nameEn: "Love Live! Sunshine!!",
          description: "설명",
        }}
        onSubmit={onSubmit}
      />
    );

    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe(
      "lovelive-sunshine"
    );
    expect(
      (screen.getByLabelText("한국어 이름") as HTMLInputElement).value
    ).toBe("러브라이브 선샤인");
    expect(
      (screen.getByLabelText("영어 이름 (선택)") as HTMLInputElement).value
    ).toBe("Love Live! Sunshine!!");
    expect(
      (screen.getByLabelText("설명 (선택)") as HTMLTextAreaElement).value
    ).toBe("설명");
  });
});
