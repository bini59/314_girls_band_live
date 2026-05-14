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

import { BandDialog } from "./BandDialog";
import type { Work } from "@prisma/client";

afterEach(() => {
  document.body.style.overflow = "";
});

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: 1,
    seriesId: null,
    slug: "bandori",
    nameKo: "뱅드림",
    nameJp: "バンドリ!",
    nameEn: null,
    kind: null,
    logoUrl: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Work;
}

function Harness({
  mode = "create" as "create" | "edit",
  initial,
  works = [makeWork()],
  onSubmit,
}: {
  mode?: "create" | "edit";
  initial?: Parameters<typeof BandDialog>[0]["initial"];
  works?: Work[];
  onSubmit: Parameters<typeof BandDialog>[0]["onSubmit"];
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <BandDialog
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      initial={initial}
      works={works}
      onSubmit={onSubmit}
    />
  );
}

describe("BandDialog — 작품 셀렉트", () => {
  it("works 가 있으면 첫 번째가 기본값", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        onSubmit={onSubmit}
        works={[
          makeWork({ id: 5, nameKo: "뱅드림" }),
          makeWork({ id: 7, nameKo: "걸즈밴드 크라이" }),
        ]}
      />
    );

    const select = screen.getByLabelText("작품") as HTMLSelectElement;
    expect(select.value).toBe("5");
    expect(select.options.length).toBe(2);
  });
});

describe("BandDialog — snsLinks 동적 입력", () => {
  it("초기에는 비어있음", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.getByText(/등록된 SNS 링크가 없습니다/)).toBeDefined();
  });

  it("'+ SNS 링크 추가' → 한 행이 추가됨", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /^\+ SNS 링크 추가$/ }));
    expect(screen.getByTestId("sns-row-0")).toBeDefined();
  });

  it("추천 키 (+ twitter) 버튼 → key 자동 채워짐", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /^\+ twitter$/ }));

    const keyInput = screen.getByLabelText("SNS 키 1") as HTMLInputElement;
    expect(keyInput.value).toBe("twitter");
  });

  it("삭제 → 행이 제거됨", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /^\+ twitter$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /SNS 링크 1 제거/ })
    );
    expect(screen.queryByTestId("sns-row-0")).toBeNull();
  });

  it("snsLinks 값이 URL 이 아니면 fieldError 표시 (클라이언트 검증)", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "mygo" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "마이고" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "MyGO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^\+ twitter$/ }));
    fireEvent.change(screen.getByLabelText("SNS URL 1"), {
      target: { value: "not-a-url" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/올바른 URL/)).toBeDefined();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("snsLinks 정상 → onSubmit 에 객체 전달", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "mygo" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "마이고" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "MyGO" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^\+ twitter$/ }));
    fireEvent.change(screen.getByLabelText("SNS URL 1"), {
      target: { value: "https://twitter.com/mygo" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        snsLinks: { twitter: "https://twitter.com/mygo" },
      })
    );
  });
});

describe("BandDialog — edit 모드 prefill", () => {
  it("initial.snsLinks → 행으로 변환", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        mode="edit"
        initial={{
          workId: 1,
          slug: "mygo",
          nameKo: "마이고",
          nameJp: "MyGO!!!!!",
          snsLinks: {
            twitter: "https://twitter.com/mygo",
            youtube: "https://youtube.com/@mygo",
          },
        }}
        onSubmit={onSubmit}
      />
    );

    expect((screen.getByLabelText("SNS 키 1") as HTMLInputElement).value).toBe(
      "twitter"
    );
    expect((screen.getByLabelText("SNS URL 1") as HTMLInputElement).value).toBe(
      "https://twitter.com/mygo"
    );
    expect((screen.getByLabelText("SNS 키 2") as HTMLInputElement).value).toBe(
      "youtube"
    );
  });
});
