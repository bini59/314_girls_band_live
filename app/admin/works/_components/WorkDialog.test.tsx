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

import { WorkDialog } from "./WorkDialog";
import type { Series } from "@prisma/client";

afterEach(() => {
  document.body.style.overflow = "";
});

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 1,
    slug: "love-live",
    nameKo: "러브라이브 시리즈",
    nameJp: "ラブライブ! シリーズ",
    nameEn: null,
    logoUrl: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Series;
}

function Harness({
  mode = "create" as "create" | "edit",
  initial,
  series = [],
  onSubmit,
}: {
  mode?: "create" | "edit";
  initial?: Parameters<typeof WorkDialog>[0]["initial"];
  series?: Series[];
  onSubmit: Parameters<typeof WorkDialog>[0]["onSubmit"];
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <WorkDialog
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      initial={initial}
      series={series}
      onSubmit={onSubmit}
    />
  );
}

describe("WorkDialog — 시리즈 셀렉트", () => {
  it("series 가 비어도 '시리즈 없음' 옵션 단독 노출", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    const select = screen.getByLabelText("시리즈 (선택)") as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].text).toMatch(/시리즈 없음/);
  });

  it("series 가 N개 있으면 셀렉트에 N+1 옵션 ('시리즈 없음' + N)", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        onSubmit={onSubmit}
        series={[
          makeSeries({ id: 1, nameKo: "러브라이브 시리즈" }),
          makeSeries({ id: 2, nameKo: "아이마스 시리즈" }),
        ]}
      />
    );

    const select = screen.getByLabelText("시리즈 (선택)") as HTMLSelectElement;
    expect(select.options.length).toBe(3);
  });
});

describe("WorkDialog — 폼 검증", () => {
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

  it("정상 입력 + seriesId 선택 → onSubmit 호출", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        onSubmit={onSubmit}
        series={[makeSeries({ id: 5, nameKo: "러브라이브 시리즈" })]}
      />
    );

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "love-live" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "러브라이브!" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "ラブライブ!" },
    });
    fireEvent.change(screen.getByLabelText("시리즈 (선택)"), {
      target: { value: "5" },
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
        nameKo: "러브라이브!",
        seriesId: 5,
      })
    );
  });

  it("seriesId 미선택은 null 로 전달", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "girls-band-cry" },
    });
    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "걸즈밴드 크라이" },
    });
    fireEvent.change(screen.getByLabelText("일본어 이름"), {
      target: { value: "ガールズバンドクライ" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: null })
    );
  });
});

describe("WorkDialog — edit 모드", () => {
  it("initial 로 폼 prefill (seriesId 포함)", () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Harness
        mode="edit"
        series={[makeSeries({ id: 5, nameKo: "러브라이브 시리즈" })]}
        initial={{
          slug: "love-live",
          nameKo: "러브라이브!",
          nameJp: "ラブライブ!",
          seriesId: 5,
          kind: "anime",
        }}
        onSubmit={onSubmit}
      />
    );

    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe(
      "love-live"
    );
    expect(
      (screen.getByLabelText("시리즈 (선택)") as HTMLSelectElement).value
    ).toBe("5");
    expect((screen.getByLabelText("종류 (선택)") as HTMLInputElement).value).toBe(
      "anime"
    );
  });
});
