// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const deleteMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../actions", () => ({
  deleteWorkAction: (...args: unknown[]) => deleteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { WorksTable } from "./WorksTable";
import type { WorkWithSeries } from "@/lib/works/repo";
import type { Series } from "@prisma/client";

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
  deleteMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("WorksTable — 빈 상태", () => {
  it("works 가 비어 있으면 안내 표시", () => {
    render(<WorksTable works={[]} />);
    expect(screen.getByText(/등록된 작품이 없습니다/)).toBeDefined();
  });
});

describe("WorksTable — 목록", () => {
  it("series 가 null 이면 '—' 표시", () => {
    render(<WorksTable works={[makeWork({ id: 1, nameKo: "걸즈밴드 크라이" })]} />);
    const row = screen.getByTestId("work-row-1");
    expect(row.textContent).toContain("걸즈밴드 크라이");
    expect(row.textContent).toContain("—");
  });

  it("series 가 있으면 nameKo 표시", () => {
    const s = makeSeries({ id: 5, nameKo: "러브라이브 시리즈" });
    render(
      <WorksTable
        works={[makeWork({ id: 7, nameKo: "러브라이브!", series: s })]}
      />
    );
    const row = screen.getByTestId("work-row-7");
    expect(row.textContent).toContain("러브라이브 시리즈");
  });
});

describe("WorksTable — 추가/편집 링크", () => {
  it("+ 작품 추가 링크가 /admin/works/new 로 이동", () => {
    render(<WorksTable works={[]} />);
    const link = screen.getByRole("link", { name: /\+ 작품 추가/ });
    expect(link.getAttribute("href")).toBe("/admin/works/new");
  });

  it("편집 링크가 /admin/works/{id}/edit 로 이동", () => {
    const w = makeWork({ id: 7, nameKo: "러브라이브 선샤인" });
    render(<WorksTable works={[w]} />);
    const link = screen.getByRole("link", { name: /러브라이브 선샤인 편집/ });
    expect(link.getAttribute("href")).toBe("/admin/works/7/edit");
  });
});

describe("WorksTable — 삭제", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("삭제 → confirm 후 deleteWorkAction 호출 + refresh", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const w = makeWork({ id: 9, nameKo: "테스트작품" });
    render(<WorksTable works={[w]} />);

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
    render(<WorksTable works={[w]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트작품 삭제/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/사용 중인 작품/)).toBeDefined();
    });
  });
});
