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
  createWorkAction: (...args: unknown[]) => createMock(...args),
  updateWorkAction: (...args: unknown[]) => updateMock(...args),
  deleteWorkAction: (...args: unknown[]) => deleteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { WorksTable } from "./WorksTable";
import type { Series } from "@prisma/client";
import type { WorkWithSeries } from "@/lib/works/repo";

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 1,
    slug: "love-live",
    nameKo: "러브라이브 시리즈",
    nameJp: "ラブライブ! シリーズ",
    nameEn: null,
    logoUrl: null,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Series;
}

function makeWork(overrides: Partial<WorkWithSeries> = {}): WorkWithSeries {
  const series = overrides.series === undefined ? null : overrides.series;
  return {
    id: 1,
    slug: "love-live",
    nameKo: "러브라이브!",
    nameJp: "ラブライブ!",
    nameEn: null,
    kind: null,
    logoUrl: null,
    description: null,
    seriesId: series ? series.id : null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
    series,
  } as WorkWithSeries;
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

describe("WorksTable — 빈 상태", () => {
  it("works 가 비어 있으면 안내 표시", () => {
    render(<WorksTable works={[]} series={[]} />);
    expect(screen.getByText(/등록된 작품이 없습니다/)).toBeDefined();
  });
});

describe("WorksTable — 목록", () => {
  it("series 가 null 이면 '—' 표시", () => {
    render(
      <WorksTable
        works={[makeWork({ id: 1, nameKo: "걸즈밴드 크라이" })]}
        series={[]}
      />
    );
    const row = screen.getByTestId("work-row-1");
    expect(row.textContent).toContain("걸즈밴드 크라이");
    expect(row.textContent).toContain("—");
  });

  it("series 가 있으면 nameKo 표시", () => {
    const s = makeSeries({ id: 5, nameKo: "러브라이브 시리즈" });
    render(
      <WorksTable
        works={[makeWork({ id: 7, nameKo: "러브라이브!", series: s })]}
        series={[s]}
      />
    );
    const row = screen.getByTestId("work-row-7");
    expect(row.textContent).toContain("러브라이브 시리즈");
  });
});

describe("WorksTable — 추가 다이얼로그", () => {
  it("+ 작품 추가 → 다이얼로그가 열리고 시리즈 셀렉트에 옵션이 노출", async () => {
    const s = makeSeries({ id: 1, nameKo: "러브라이브 시리즈" });
    render(<WorksTable works={[]} series={[s]} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ 작품 추가/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /작품 추가/ })).toBeDefined();
    });
    const select = screen.getByLabelText("시리즈 (선택)") as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(
      Array.from(select.options).some((o) =>
        o.text.includes("러브라이브 시리즈")
      )
    ).toBe(true);
  });
});

describe("WorksTable — 편집 prefill", () => {
  it("편집 클릭 → initial 로 prefill", async () => {
    const s = makeSeries({ id: 5, nameKo: "러브라이브 시리즈" });
    const w = makeWork({
      id: 7,
      slug: "lovelive-sunshine",
      nameKo: "러브라이브 선샤인",
      nameJp: "ラブライブ! サンシャイン!!",
      series: s,
    });
    render(<WorksTable works={[w]} series={[s]} />);

    fireEvent.click(
      screen.getByRole("button", { name: /러브라이브 선샤인 편집/ })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /작품 편집/ })).toBeDefined();
    });

    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe(
      "lovelive-sunshine"
    );
    expect(
      (screen.getByLabelText("시리즈 (선택)") as HTMLSelectElement).value
    ).toBe("5");
  });
});

describe("WorksTable — 삭제", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("삭제 → confirm 후 deleteWorkAction 호출 + refresh", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const w = makeWork({ id: 9, nameKo: "테스트작품" });
    render(<WorksTable works={[w]} series={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트작품 삭제/ }));
    });

    expect(deleteMock).toHaveBeenCalledWith(9);
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("삭제 실패 시 에러 메시지 표시 (P2003)", async () => {
    deleteMock.mockResolvedValue({
      ok: false,
      error: "사용 중인 작품은 삭제할 수 없습니다.",
    });
    const w = makeWork({ id: 9, nameKo: "테스트작품" });
    render(<WorksTable works={[w]} series={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트작품 삭제/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/사용 중인 작품/)).toBeDefined();
    });
  });
});
