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

const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../actions", () => ({
  createSeriesAction: (...args: unknown[]) => createMock(...args),
  updateSeriesAction: (...args: unknown[]) => updateMock(...args),
  deleteSeriesAction: (...args: unknown[]) => deleteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { SeriesTable } from "./SeriesTable";
import type { Series } from "@prisma/client";

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 1,
    slug: "love-live",
    nameKo: "러브라이브",
    nameJp: "ラブライブ!",
    nameEn: null,
    logoUrl: null,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Series;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("SeriesTable — 빈 상태", () => {
  it("series 가 비어 있으면 안내 문구 표시", () => {
    render(<SeriesTable series={[]} />);
    expect(screen.getByText(/등록된 시리즈가 없습니다/)).toBeDefined();
  });
});

describe("SeriesTable — 목록 + 추가", () => {
  it("각 series row 가 렌더된다", () => {
    render(
      <SeriesTable
        series={[
          makeSeries({ id: 1, slug: "love-live", nameKo: "러브라이브" }),
          makeSeries({ id: 2, slug: "bandori", nameKo: "뱅드림" }),
        ]}
      />
    );
    expect(screen.getByText("love-live")).toBeDefined();
    expect(screen.getByText("bandori")).toBeDefined();
    expect(screen.getByText("러브라이브")).toBeDefined();
    expect(screen.getByText("뱅드림")).toBeDefined();
  });

  it("+ 시리즈 추가 → create 다이얼로그가 열린다", async () => {
    render(<SeriesTable series={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ 시리즈 추가/ }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /시리즈 추가/ })
      ).toBeDefined();
    });
  });
});

describe("SeriesTable — 편집", () => {
  it("편집 클릭 → initial prefill 된 다이얼로그가 열린다", async () => {
    const s = makeSeries({
      id: 7,
      slug: "lovelive-sunshine",
      nameKo: "러브라이브 선샤인",
      nameJp: "ラブライブ! サンシャイン!!",
      nameEn: "Love Live! Sunshine!!",
    });
    render(<SeriesTable series={[s]} />);

    fireEvent.click(
      screen.getByRole("button", { name: /러브라이브 선샤인 편집/ })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /시리즈 편집/ })
      ).toBeDefined();
    });
    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe(
      "lovelive-sunshine"
    );
    expect(
      (screen.getByLabelText("한국어 이름") as HTMLInputElement).value
    ).toBe("러브라이브 선샤인");
  });

  it("편집 저장 → updateSeriesAction 호출 + refresh", async () => {
    updateMock.mockResolvedValue({ ok: true, series: makeSeries() });
    const s = makeSeries({ id: 7 });
    render(<SeriesTable series={[s]} />);

    fireEvent.click(screen.getByRole("button", { name: /러브라이브 편집/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /시리즈 편집/ })
      ).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("한국어 이름"), {
      target: { value: "러브라이브 (수정)" },
    });

    const form = screen
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(updateMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ nameKo: "러브라이브 (수정)" })
    );
    expect(refreshMock).toHaveBeenCalled();
  });
});

describe("SeriesTable — 삭제", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("삭제 → confirm 후 deleteSeriesAction 호출 + refresh", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const s = makeSeries({ id: 9, nameKo: "테스트시리즈" });
    render(<SeriesTable series={[s]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트시리즈 삭제/ }));
    });

    expect(deleteMock).toHaveBeenCalledWith(9);
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("confirm 취소 시 deleteSeriesAction 호출되지 않음", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const s = makeSeries({ id: 9, nameKo: "테스트시리즈" });
    render(<SeriesTable series={[s]} />);

    fireEvent.click(screen.getByRole("button", { name: /테스트시리즈 삭제/ }));
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("삭제 실패 시 에러 메시지 표시", async () => {
    deleteMock.mockResolvedValue({
      ok: false,
      error: "이미 삭제된 시리즈입니다.",
    });
    const s = makeSeries({ id: 9, nameKo: "테스트시리즈" });
    render(<SeriesTable series={[s]} />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /테스트시리즈 삭제/ })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/이미 삭제된 시리즈/)).toBeDefined();
    });
  });
});
